"""
Generation Agent — Takes the scene plan and generates all media assets
in parallel: videos, images, voiceovers, sound effects, and music.
Polls predictions to completion and uploads results to Supabase storage.
Injects character consistency prompts from Pinecone embeddings.
"""

import asyncio
import logging
import time
from typing import Optional

from app.services.ai_video.replicate_provider import ReplicateProvider
from app.services.ai_video.elevenlabs_provider import ElevenLabsProvider
from app.services.storage_service import upload_bytes, upload_from_url
from app.services.generation_cache import get_cached, set_cached
from app.http_client import get_http_client
from app.config import settings
from app.services.pipeline_metrics import metrics
from app.services.character_consistency_pipeline import CharacterConsistencyPipeline
from app.services.voice_service import VoiceService

logger = logging.getLogger(__name__)

# ── Replicate Model Registry ──────────────────────────────────────────────────
REPLICATE_MODELS = {
    "text_to_image": {
        "flux-schnell": "black-forest-labs/flux-schnell",
        "flux-dev":     "black-forest-labs/flux-dev",
        "sdxl":         "stability-ai/sdxl:latest",
    },
    "text_to_video": {
        "minimax":  "minimax/video-01",
        "wan":      "wavespeedai/wan-2.1-t2v-480p",
    },
    "image_to_video": {
        "svd":      "stability-ai/stable-video-diffusion",
        "wan-i2v":  "wavespeedai/wan-2.1-i2v-480p",
    },
    "video_to_video": {
        "animate-diff": "lucataco/animate-diff",
    },
}


def _augment_prompt_with_cinematography(prompt: str, camera: dict, lighting: dict) -> str:
    """Inject camera angle and lighting details into the generation prompt."""
    parts = [prompt]

    if camera:
        angle = camera.get("angle", "")
        movement = camera.get("movement", "")
        framing = camera.get("framing", "")
        if angle:
            parts.append(f"Camera angle: {angle.replace('_', ' ')}")
        if movement:
            parts.append(f"Camera movement: {movement.replace('_', ' ')}")
        if framing:
            parts.append(f"Framing: {framing.replace('_', ' ')}")

    if lighting:
        light_type = lighting.get("type", "")
        mood = lighting.get("mood", "")
        direction = lighting.get("direction", "")
        if light_type:
            parts.append(f"Lighting: {light_type.replace('_', ' ')}")
        if mood:
            parts.append(f"Lighting mood: {mood}")
        if direction:
            parts.append(f"Light direction: {direction.replace('_', ' ')}")

    return ". ".join(parts)


class GenerationAgent:
    """Generates all media assets for a scene plan in parallel."""

    def __init__(self, session_id: str | None = None):
        self.replicate = ReplicateProvider()
        self.elevenlabs = ElevenLabsProvider()
        self.voice_service = VoiceService()
        self.consistency_pipeline = CharacterConsistencyPipeline()
        self._character_references: dict[str, dict] = {}
        self._session_id = session_id

    async def run(self, state: dict) -> dict:
        """Generate assets for all scenes concurrently."""
        plan = state.get("scene_plan", {})
        scenes = plan.get("scenes", [])
        character_profiles = state.get("character_profiles", {})

        if not scenes:
            return {**state, "error": "No scenes in plan", "status": "failed"}

        tasks = []
        for scene in scenes:
            tasks.append(self._generate_scene_assets(scene, character_profiles))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        generated_assets = []
        errors = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Scene {scenes[i].get('scene_id', i)} generation failed: {result}")
                errors.append(f"Scene {scenes[i].get('scene_id', i)}: {str(result)}")
                generated_assets.append({
                    "scene_id": scenes[i].get("scene_id", f"s{i}"),
                    "video_url": None,
                    "audio_url": None,
                    "error": str(result),
                })
            else:
                generated_assets.append(result)

        # Generate background music if specified
        music_url = None
        music_track = plan.get("music_track")
        if music_track:
            try:
                music_url = await self._generate_music(music_track)
            except Exception as e:
                logger.error(f"Music generation failed: {e}")

        # Generate sound effects and upload to storage
        sfx_results = []
        for sfx in plan.get("sound_effects", []):
            try:
                sfx_audio = await self.elevenlabs.generate_sound_effect(
                    prompt=sfx["description"],
                    duration_seconds=sfx.get("duration", 2.0)
                )
                if sfx_audio:
                    sfx_url = await upload_bytes(
                        sfx_audio, "mp3", "audio/mpeg",
                        prefix=f"sfx/{sfx.get('scene_id', 'unknown')}"
                    )
                    sfx_results.append({
                        "scene_id": sfx["scene_id"],
                        "description": sfx["description"],
                        "audio_url": sfx_url,
                        "start_offset": sfx.get("start_offset", 0),
                    })
            except Exception as e:
                logger.error(f"SFX generation failed: {e}")

        return {
            **state,
            "generated_assets": generated_assets,
            "music_url": music_url,
            "sound_effects_generated": sfx_results,
            "generation_errors": errors if errors else None,
            "status": "editing",
            "messages": state.get("messages", []) + [
                {"role": "agent", "content": f"Generated {len(generated_assets)} scene assets, {len(sfx_results)} SFX"}
            ]
        }

    async def _generate_scene_assets(self, scene: dict, characters: dict) -> dict:
        """Generate video/image + voiceover for a single scene, wait for completion, upload to storage."""
        scene_id = scene.get("scene_id", "unknown")
        visual_type = scene.get("visual_type", "text_to_video")
        base_prompt = scene.get("prompt", scene.get("description", ""))
        camera = scene.get("camera", {})
        lighting = scene.get("lighting", {})
        duration = scene.get("duration", 5)

        full_prompt = _augment_prompt_with_cinematography(base_prompt, camera, lighting)

        # Augment with character consistency
        char_ids = scene.get("character_ids", [])
        for cid in char_ids:
            char = characters.get(cid)
            if char and char.get("style_suffix"):
                full_prompt += f". {char['style_suffix']}"

        # Determine canvas-aware dimensions for image generation
        canvas_width = characters.get("_canvas_width", 1920)
        canvas_height = characters.get("_canvas_height", 1080)
        aspect_ratio = canvas_width / canvas_height if canvas_height > 0 else 16 / 9
        # Map to nearest supported generation size
        if aspect_ratio > 1.5:  # landscape 16:9
            gen_width, gen_height = 1024, 576
        elif aspect_ratio < 0.7:  # portrait 9:16
            gen_width, gen_height = 576, 1024
        else:  # square-ish
            gen_width, gen_height = 1024, 1024

        result = {"scene_id": scene_id, "video_url": None, "image_url": None, "audio_url": None}

        # Generate character reference sheets if needed (cached per character)
        char_ids = scene.get("character_ids", [])
        for cid in char_ids:
            if cid not in self._character_references and cid in characters:
                char = characters[cid]
                if char.get("description"):
                    try:
                        refs = await self.consistency_pipeline.generate_reference_sheet(char["description"])
                        if refs:
                            self._character_references[cid] = refs
                    except Exception as e:
                        logger.warning(f"Reference sheet generation failed for {cid}: {e}")

        # Check generation cache before making expensive API calls
        model_name = "text_to_video" if visual_type == "text_to_video" else "text_to_image"
        cached = get_cached(full_prompt, model_name)
        if cached:
            logger.info(f"Cache hit for scene {scene_id}")
            result.update(cached)
            return result

        # Generate visual asset with metrics tracking
        gen_start = time.time()
        gen_success = False
        try:
            if visual_type == "text_to_video":
                gen_result = await self.replicate.text_to_video(
                    prompt=full_prompt,
                    duration=min(duration, 8),
                    wait=True,
                )
                output_url = gen_result.get("output_url")
                if output_url:
                    stored_url = await upload_from_url(
                        output_url, "mp4", "video/mp4",
                        prefix=f"scenes/{scene_id}"
                    )
                    result["video_url"] = stored_url
                    gen_success = True
                result["prediction_id"] = gen_result.get("prediction_id")

            elif visual_type in ("text_to_image", "static_image"):
                # Use character-consistent generation when references exist
                if char_ids and any(cid in self._character_references for cid in char_ids):
                    gen_result = await self.consistency_pipeline.generate_consistent_scene(
                        prompt=full_prompt,
                        character_ids=char_ids,
                        character_references=self._character_references,
                    )
                else:
                    gen_result = await self.replicate.text_to_image(
                        prompt=full_prompt,
                        width=gen_width,
                        height=gen_height,
                        wait=True,
                    )
                output_url = gen_result.get("output_url") or gen_result.get("stored_url")
                if output_url:
                    if not gen_result.get("stored_url"):
                        output_url = await upload_from_url(
                            output_url, "png", "image/png",
                            prefix=f"scenes/{scene_id}"
                        )
                    result["image_url"] = output_url
                    gen_success = True
                result["prediction_id"] = gen_result.get("prediction_id")

            elif visual_type == "image_to_video":
                source_image = scene.get("source_image_url")
                if source_image:
                    gen_result = await self.replicate.image_to_video(
                        image_url=source_image,
                        prompt=full_prompt,
                        wait=True,
                    )
                    output_url = gen_result.get("output_url")
                    if output_url:
                        stored_url = await upload_from_url(
                            output_url, "mp4", "video/mp4",
                            prefix=f"scenes/{scene_id}"
                        )
                        result["video_url"] = stored_url
                        gen_success = True
                    result["prediction_id"] = gen_result.get("prediction_id")

            elif visual_type in ("stock_video", "stock_image"):
                search_query = scene.get("prompt", "cinematic b-roll")
                media_type = "video" if visual_type == "stock_video" else "photo"
                stock_url = await self._fetch_stock_media(search_query, media_type)

                if stock_url:
                    ext = "mp4" if media_type == "video" else "jpg"
                    mime = "video/mp4" if media_type == "video" else "image/jpeg"
                    stored_url = await upload_from_url(
                        stock_url, ext, mime, prefix=f"scenes/{scene_id}"
                    )
                    if media_type == "video":
                        result["video_url"] = stored_url
                    else:
                        result["image_url"] = stored_url
                    gen_success = True
                else:
                    raise ValueError(f"No stock {media_type} found for query: {search_query}")

            elif visual_type == "motion_graphic":
                # Defer rendering: Remotion handles this natively on the timeline.
                result["video_url"] = "deferred_motion_graphic"
                gen_success = True

        except Exception as e:
            logger.error(f"Visual generation failed for {scene_id}: {e}")
            result["visual_error"] = str(e)
        finally:
            gen_duration = time.time() - gen_start
            metrics.record_generation(
                model="stock" if visual_type in ("stock_video", "stock_image") else model_name,
                duration_seconds=gen_duration,
                success=gen_success,
                cost_usd=0.0 if visual_type in ("stock_video", "stock_image") else (0.50 if visual_type == "text_to_video" else 0.05),
                session_id=self._session_id,
            )

        # Cache successful generation results
        if gen_success:
            cache_data = {k: v for k, v in result.items() if k in ("video_url", "image_url", "scene_id")}
            set_cached(full_prompt, model_name, cache_data)

        # Generate voiceover using VoiceService for per-character voice selection
        voiceover = scene.get("voiceover")
        if voiceover and voiceover.get("text"):
            try:
                speaker_id = voiceover.get("speaker")
                emotion = scene.get("mood", "neutral")
                character = characters.get(speaker_id, {"char_id": speaker_id or "narrator"})
                audio_url = await self.voice_service.generate_dialog(
                    text=voiceover["text"],
                    character=character,
                    emotion=emotion,
                )
                if audio_url:
                    result["audio_url"] = audio_url
                    result["voiceover_text"] = voiceover["text"]
            except Exception as e:
                logger.error(f"Voiceover generation failed for {scene_id}: {e}")

        return result

    async def _generate_music(self, music_track: dict) -> Optional[str]:
        """Generate background music: stock search first, then Replicate MusicGen, then ElevenLabs SFX."""
        description = music_track.get("description", "background music")
        mood = music_track.get("mood", "")
        prompt = f"{description}. Mood: {mood}" if mood else description

        # Primary: search Pixabay for stock music
        if settings.PIXABAY_API_KEY:
            try:
                client = await get_http_client()
                resp = await client.get(
                    "https://pixabay.com/api/",
                    params={
                        "key": settings.PIXABAY_API_KEY,
                        "q": prompt,
                        "media_type": "music",
                        "per_page": "3",
                    },
                )
                if resp.status_code == 200:
                    hits = resp.json().get("hits", [])
                    if hits:
                        audio_url = hits[0].get("audio")
                        if audio_url:
                            return await upload_from_url(
                                audio_url, "mp3", "audio/mpeg", prefix="music/pixabay"
                            )
            except Exception as e:
                logger.warning(f"Pixabay music search failed: {e}")

        # Fallback: Replicate MusicGen
        try:
            gen_result = await self.replicate.generate_music(
                prompt=prompt,
                duration=music_track.get("duration", 30),
            )
            output_url = gen_result.get("output_url")
            if output_url:
                return await upload_from_url(
                    output_url, "mp3", "audio/mpeg", prefix="music/replicate"
                )
        except Exception as e:
            logger.warning(f"MusicGen via Replicate failed: {e}")

        # Last resort: ElevenLabs sound effect as ambient audio
        try:
            audio_bytes = await self.elevenlabs.generate_sound_effect(
                prompt=f"Background music: {description}",
                duration_seconds=30.0,
            )
            if audio_bytes:
                return await upload_bytes(audio_bytes, "mp3", "audio/mpeg", prefix="music/elevenlabs")
        except Exception as e:
            logger.warning(f"Music generation via ElevenLabs failed: {e}")
        return None

    async def _fetch_stock_media(self, query: str, media_type: str) -> Optional[str]:
        """Fetch a stock video or photo URL from Pexels API."""
        if not settings.PEXELS_API_KEY:
            return None

        try:
            client = await get_http_client()
            endpoint = "https://api.pexels.com/videos/search" if media_type == "video" else "https://api.pexels.com/v1/search"
            resp = await client.get(
                endpoint,
                params={"query": query, "per_page": "1"},
                headers={"Authorization": settings.PEXELS_API_KEY},
            )

            if resp.status_code == 200:
                data = resp.json()
                if media_type == "video":
                    videos = data.get("videos", [])
                    if videos:
                        files = videos[0].get("video_files", [])
                        best_file = next((f for f in files if f.get("quality") == "hd"), files[0] if files else None)
                        if best_file:
                            return best_file["link"]
                else:
                    photos = data.get("photos", [])
                    if photos:
                        return photos[0].get("src", {}).get("original")
        except Exception as e:
            logger.error(f"Failed to fetch stock media for '{query}': {e}")
            
        return None

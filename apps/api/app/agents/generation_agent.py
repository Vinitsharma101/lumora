"""
Generation Agent — Takes the scene plan and generates all media assets
in parallel: videos, images, voiceovers, sound effects, and music.
Injects character consistency prompts from Pinecone embeddings.
"""

import asyncio
import logging
from typing import Optional

from app.services.ai_video.replicate_provider import ReplicateProvider
from app.services.ai_video.elevenlabs_provider import ElevenLabsProvider

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

    def __init__(self):
        self.replicate = ReplicateProvider()
        self.elevenlabs = ElevenLabsProvider()

    async def run(self, state: dict) -> dict:
        """Generate assets for all scenes concurrently."""
        plan = state.get("scene_plan", {})
        scenes = plan.get("scenes", [])
        character_profiles = state.get("character_profiles", {})

        if not scenes:
            return {**state, "error": "No scenes in plan", "status": "failed"}

        # Generate all scene assets in parallel
        tasks = []
        for scene in scenes:
            tasks.append(self._generate_scene_assets(scene, character_profiles))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        generated_assets = []
        errors = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Scene {scenes[i]['scene_id']} generation failed: {result}")
                errors.append(f"Scene {scenes[i]['scene_id']}: {str(result)}")
                generated_assets.append({
                    "scene_id": scenes[i]["scene_id"],
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

        # Generate sound effects
        sfx_results = []
        for sfx in plan.get("sound_effects", []):
            try:
                sfx_audio = await self.elevenlabs.generate_sound_effect(
                    prompt=sfx["description"],
                    duration_seconds=sfx.get("duration", 2.0)
                )
                sfx_results.append({
                    "scene_id": sfx["scene_id"],
                    "description": sfx["description"],
                    "audio_bytes_len": len(sfx_audio) if sfx_audio else 0,
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
        """Generate video/image + voiceover for a single scene."""
        scene_id = scene["scene_id"]
        visual_type = scene.get("visual_type", "text_to_video")
        base_prompt = scene.get("prompt", scene.get("description", ""))
        camera = scene.get("camera", {})
        lighting = scene.get("lighting", {})
        duration = scene.get("duration", 5)

        # Augment prompt with cinematography
        full_prompt = _augment_prompt_with_cinematography(base_prompt, camera, lighting)

        # Augment with character consistency
        char_ids = scene.get("character_ids", [])
        for cid in char_ids:
            char = characters.get(cid)
            if char and char.get("style_suffix"):
                full_prompt += f". {char['style_suffix']}"

        result = {"scene_id": scene_id, "video_url": None, "image_url": None, "audio_url": None}

        # Generate visual asset
        try:
            if visual_type == "text_to_video":
                video_output = await self.replicate.text_to_video(
                    prompt=full_prompt,
                    duration=min(duration, 8),
                )
                result["video_url"] = video_output
            elif visual_type == "text_to_image" or visual_type == "static_image":
                image_output = await self.replicate.text_to_image(
                    prompt=full_prompt,
                    width=1024,
                    height=576,
                )
                result["image_url"] = image_output
            elif visual_type == "image_to_video":
                # Requires a source image URL in the scene
                source_image = scene.get("source_image_url")
                if source_image:
                    video_output = await self.replicate.image_to_video(
                        image_url=source_image,
                        prompt=full_prompt,
                    )
                    result["video_url"] = video_output
        except Exception as e:
            logger.error(f"Visual generation failed for {scene_id}: {e}")
            result["visual_error"] = str(e)

        # Generate voiceover if specified
        voiceover = scene.get("voiceover")
        if voiceover and voiceover.get("text"):
            try:
                audio_bytes = await self.elevenlabs.text_to_speech(
                    text=voiceover["text"],
                )
                if audio_bytes:
                    result["voiceover_bytes_len"] = len(audio_bytes)
                    result["voiceover_text"] = voiceover["text"]
            except Exception as e:
                logger.error(f"Voiceover generation failed for {scene_id}: {e}")

        return result

    async def _generate_music(self, music_track: dict) -> Optional[str]:
        """Generate background music (placeholder — delegate to Suno/ElevenLabs)."""
        # ElevenLabs can generate sound effects as ambient audio
        description = music_track.get("description", "background music")
        try:
            audio_bytes = await self.elevenlabs.generate_sound_effect(
                text=f"Background music: {description}",
                duration_seconds=30.0,
            )
            if audio_bytes:
                return f"generated_music_{len(audio_bytes)}_bytes"
        except Exception as e:
            logger.warning(f"Music generation via ElevenLabs failed: {e}")
        return None

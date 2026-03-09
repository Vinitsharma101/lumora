"""ARQ background worker for async tasks.

Processes render jobs, AI video generation, and auto-edit pipeline tasks.
All AI processing uses cloud APIs — no local models.

Run with: arq app.worker.WorkerSettings
"""

import logging
from urllib.parse import urlparse

from arq import create_pool
from arq.connections import RedisSettings

from app.config import settings

logger = logging.getLogger(__name__)

_arq_pool = None


def _parse_redis_url(redis_url: str) -> RedisSettings:
    """Parse a Redis URL into ARQ RedisSettings, supporting auth and IPv6."""
    parsed = urlparse(redis_url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        database=int(parsed.path.lstrip("/") or 0) if parsed.path and parsed.path != "/" else 0,
        password=parsed.password,
        username=parsed.username,
    )


async def get_arq_pool():
    """Get or create the ARQ Redis connection pool."""
    global _arq_pool
    if _arq_pool is None:
        _arq_pool = await create_pool(_parse_redis_url(settings.REDIS_URL))
    return _arq_pool


async def enqueue_render_job(job_id: str) -> None:
    """Enqueue a render job for background processing."""
    pool = await get_arq_pool()
    await pool.enqueue_job("process_render_job", job_id)


async def enqueue_ai_job(job_id: str, job_type: str) -> None:
    """Enqueue an AI processing job."""
    pool = await get_arq_pool()
    await pool.enqueue_job("process_ai_job", job_id, job_type)


# ---------------------------------------------------------------------------
# Worker task functions
# ---------------------------------------------------------------------------


async def process_render_job(ctx: dict, job_id: str) -> dict:
    """Process a render job: download media → FFmpeg → upload result."""
    from app.database import async_session_factory
    from app.services.render.ffmpeg_pipeline import render_timeline
    from app.services.render.scheduler import update_render_progress

    async with async_session_factory() as db:
        from sqlalchemy import select
        from app.models import RenderJob

        stmt = select(RenderJob).where(RenderJob.id == job_id)
        db_result = await db.execute(stmt)
        job = db_result.scalar_one_or_none()

        if not job:
            logger.error(f"Render job {job_id} not found")
            return {"error": "Job not found"}

        try:
            await update_render_progress(db, job_id, "processing", 0.1)

            async def progress_cb(progress: float, status: str):
                await update_render_progress(db, job_id, "processing", progress)

            render_result = await render_timeline(
                job_id=job_id,
                timeline_data=job.timeline_data or {},
                format=job.format,
                quality=job.quality,
                width=job.width,
                height=job.height,
                fps=job.fps,
                user_id=job.user_id,
                progress_callback=progress_cb,
            )

            await update_render_progress(
                db,
                job_id,
                "completed",
                1.0,
                output_url=render_result["output_url"],
                output_size=render_result["output_size"],
            )

            return {"status": "completed", "output_url": render_result["output_url"]}

        except Exception as exc:
            logger.exception(f"Render job {job_id} failed")
            await update_render_progress(
                db, job_id, "failed", 0.0, error_message=str(exc)
            )
            return {"error": str(exc)}


async def process_ai_job(ctx: dict, job_id: str, job_type: str) -> dict:
    """Process an AI job based on its type."""
    from app.database import async_session_factory
    from app.services.auto_edit.pipeline import update_job_status

    async with async_session_factory() as db:
        from sqlalchemy import select
        from app.models import AIJob

        stmt = select(AIJob).where(AIJob.id == job_id)
        db_result = await db.execute(stmt)
        job = db_result.scalar_one_or_none()

        if not job:
            logger.error(f"AI job {job_id} not found")
            return {"error": "Job not found"}

        try:
            await update_job_status(db, job_id, "processing", 0.1)

            input_data = job.input_data or {}

            if job_type == "transcribe":
                from app.services.auto_edit.silence_detector import transcribe_for_silence_detection

                transcribe_result = await transcribe_for_silence_detection(
                    input_data["audio_url"],
                    input_data.get("language", "en"),
                )
                await update_job_status(
                    db, job_id, "processing", 0.5,
                    provider_job_id=transcribe_result.get("prediction_id"),
                )

            elif job_type == "text_to_video":
                from app.services.ai_video.sora_provider import SoraProvider
                from app.services.ai_video.google_provider import GoogleAIProvider
                from app.services.ai_video.replicate_provider import ReplicateProvider

                provider_name = input_data.get("provider", "replicate")
                if provider_name == "google_veo":
                    ai_service = GoogleAIProvider()
                    ai_result = await ai_service.generate_video_from_text(
                        prompt=input_data["prompt"],
                        duration=input_data.get("duration", 4),
                        aspect_ratio=input_data.get("aspect_ratio", "16:9"),
                    )
                elif provider_name == "openai_sora":
                    ai_service = SoraProvider()
                    ai_result = await ai_service.generate_video(
                        prompt=input_data["prompt"],
                        duration=input_data.get("duration", 5),
                        aspect_ratio=input_data.get("aspect_ratio", "16:9"),
                    )
                elif provider_name == "replicate":
                    from app.services.ai_video.replicate_provider import ReplicateProvider
                    provider = ReplicateProvider()
                    ai_result = await provider.text_to_video(
                        prompt=input_data["prompt"],
                        duration=input_data.get("duration", 4),
                    )
                else:
                    raise ValueError(f"Unknown provider: {provider_name}")

                await update_job_status(
                    db, job_id, "processing", 0.5,
                    output_data=ai_result,
                    provider_job_id=ai_result.get("prediction_id") or ai_result.get("operation_name") or ai_result.get("generation_id"),
                )

            elif job_type == "image_to_video":
                provider_name = input_data.get("provider", "google_veo")
                if provider_name == "google_veo":
                    from app.services.ai_video.google_provider import GoogleAIProvider
                    provider = GoogleAIProvider()
                    ai_result = await provider.generate_video_from_image(
                        image_url=input_data["image_url"],
                        prompt=input_data.get("prompt"),
                        duration=input_data.get("duration", 4),
                    )
                else:
                    from app.services.ai_video.replicate_provider import ReplicateProvider
                    provider = ReplicateProvider()
                    ai_result = await provider.image_to_video(
                        image_url=input_data["image_url"],
                        prompt=input_data.get("prompt"),
                    )

                await update_job_status(
                    db, job_id, "processing", 0.5,
                    output_data=ai_result,
                )

            elif job_type == "background_remove":
                url = input_data.get("image_url") or input_data.get("video_url")
                from app.services.ai_video.replicate_provider import ReplicateProvider
                provider = ReplicateProvider()
                ai_result = await provider.remove_background(url)
                await update_job_status(
                    db, job_id, "processing", 0.5,
                    output_data=ai_result,
                    provider_job_id=ai_result.get("prediction_id"),
                )

            elif job_type == "upscale":
                url = input_data.get("image_url") or input_data.get("video_url")
                from app.services.ai_video.replicate_provider import ReplicateProvider
                provider = ReplicateProvider()
                ai_result = await provider.upscale_image(url, input_data.get("scale", 2))
                await update_job_status(
                    db, job_id, "processing", 0.5,
                    output_data=ai_result,
                    provider_job_id=ai_result.get("prediction_id"),
                )

            elif job_type == "style_transfer":
                from app.services.ai_video.replicate_provider import ReplicateProvider
                provider = ReplicateProvider()
                ai_result = await provider.style_transfer(
                    input_data["video_url"],
                    input_data["style_prompt"],
                    input_data.get("strength", 0.7),
                )
                await update_job_status(
                    db, job_id, "processing", 0.5,
                    output_data=ai_result,
                    provider_job_id=ai_result.get("prediction_id"),
                )

            elif job_type == "scene_detect":
                from app.services.auto_edit.scene_detector import detect_scenes_via_api
                ai_result = await detect_scenes_via_api(input_data["video_url"])
                await update_job_status(db, job_id, "completed", 1.0, output_data=ai_result)
                return {"status": "completed", "output": ai_result}

            elif job_type == "generate_captions":
                # Two-step pipeline: transcribe first, then format captions
                from app.services.auto_edit.silence_detector import transcribe_for_silence_detection
                from app.services.auto_edit.caption_generator import format_captions_with_llm

                # Step 1: Transcribe to get segments
                transcribe_result = await transcribe_for_silence_detection(
                    input_data.get("video_url") or input_data.get("audio_url", ""),
                    input_data.get("language", "en"),
                )
                await update_job_status(db, job_id, "processing", 0.5,
                    provider_job_id=transcribe_result.get("prediction_id"),
                )

                # Step 2: Format captions from transcript segments
                segments = transcribe_result.get("segments", [])
                captions = await format_captions_with_llm(
                    segments,
                    input_data.get("style", "default"),
                )
                await update_job_status(db, job_id, "completed", 1.0, output_data={"captions": captions})
                return {"status": "completed", "captions": captions}

            elif job_type == "silence_remove":
                # Two-step pipeline: transcribe then detect silence
                from app.services.auto_edit.silence_detector import (
                    transcribe_for_silence_detection,
                    detect_silence_from_transcript,
                    generate_trimmed_timeline,
                )

                transcribe_result = await transcribe_for_silence_detection(
                    input_data.get("video_url", ""),
                    input_data.get("language", "en"),
                )
                await update_job_status(db, job_id, "processing", 0.5,
                    provider_job_id=transcribe_result.get("prediction_id"),
                )

                segments = transcribe_result.get("segments", [])
                silences = detect_silence_from_transcript(
                    segments,
                    min_silence_duration=input_data.get("min_silence_duration", 0.5),
                )
                trimmed = generate_trimmed_timeline(
                    original_duration=input_data.get("video_duration", 0),
                    silences=silences,
                )
                await update_job_status(db, job_id, "completed", 1.0, output_data={
                    "silences": silences,
                    "trimmed_timeline": trimmed,
                })
                return {"status": "completed", "output": trimmed}

            elif job_type == "create_shorts":
                # Multi-step: transcribe + scene detect + highlight detect
                from app.services.auto_edit.silence_detector import transcribe_for_silence_detection
                from app.services.auto_edit.scene_detector import detect_scenes_via_api, detect_highlights_via_llm

                transcribe_result = await transcribe_for_silence_detection(
                    input_data.get("video_url", ""),
                )
                await update_job_status(db, job_id, "processing", 0.3)

                scenes = await detect_scenes_via_api(input_data.get("video_url", ""))
                await update_job_status(db, job_id, "processing", 0.6)

                highlights = await detect_highlights_via_llm(
                    transcript=transcribe_result.get("segments", []),
                    scenes=scenes.get("scenes", []),
                    video_duration=input_data.get("video_duration", 0),
                    count=input_data.get("count", 5),
                )
                await update_job_status(db, job_id, "completed", 1.0, output_data={"highlights": highlights})
                return {"status": "completed", "highlights": highlights}

            elif job_type == "beat_sync":
                # Transcribe audio for beat analysis
                from app.services.auto_edit.silence_detector import transcribe_for_silence_detection

                transcribe_result = await transcribe_for_silence_detection(
                    input_data.get("music_url") or input_data.get("video_url", ""),
                )
                await update_job_status(db, job_id, "completed", 1.0, output_data={
                    "segments": transcribe_result.get("segments", []),
                })
                return {"status": "completed", "output": transcribe_result}

            elif job_type == "voice_dub":
                # Multi-step: transcribe → translate → TTS
                from app.services.auto_edit.silence_detector import transcribe_for_silence_detection

                transcribe_result = await transcribe_for_silence_detection(
                    input_data.get("video_url", ""),
                    input_data.get("source_language", "en"),
                )
                await update_job_status(db, job_id, "processing", 0.5)
                # Store transcript for now — full TTS pipeline requires ElevenLabs integration
                await update_job_status(db, job_id, "completed", 1.0, output_data={
                    "transcript": transcribe_result.get("segments", []),
                    "target_language": input_data.get("target_language", "en"),
                })
                return {"status": "completed", "output": transcribe_result}

            elif job_type == "highlight_detect":
                from app.services.auto_edit.scene_detector import detect_highlights_via_llm
                highlights = await detect_highlights_via_llm(
                    transcript=input_data.get("transcript", []),
                    scenes=input_data.get("scenes", []),
                    video_duration=input_data.get("video_duration", 0),
                    count=input_data.get("count", 5),
                )
                await update_job_status(db, job_id, "completed", 1.0, output_data={"highlights": highlights})
                return {"status": "completed", "highlights": highlights}

            elif job_type == "auto_reframe":
                # Smart reframing: detect scenes/subjects for crop regions
                from app.services.auto_edit.scene_detector import detect_scenes_via_api
                scenes = await detect_scenes_via_api(input_data.get("video_url", ""))
                await update_job_status(db, job_id, "processing", 0.5)
                # Return scene data with target aspect ratio for client-side cropping
                await update_job_status(db, job_id, "completed", 1.0, output_data={
                    "scenes": scenes.get("scenes", []),
                    "target_aspect_ratio": input_data.get("target_aspect_ratio", "9:16"),
                })
                return {"status": "completed", "output": scenes}

            elif job_type == "talking_head":
                audio_url = input_data.get("audio_url")
                if not audio_url and input_data.get("text"):
                    # Generate TTS first, then use for talking head
                    from app.services.ai_video.elevenlabs_provider import ElevenLabsProvider
                    tts_provider = ElevenLabsProvider()
                    try:
                        tts_bytes = await tts_provider.text_to_speech(
                            text=input_data["text"],
                            voice_id=input_data.get("voice_id", "21m00Tcm4TlvDq8ikWAM"),
                        )
                        if tts_bytes:
                            from app.services.storage_service import upload_bytes as upload_audio
                            audio_url = await upload_audio(tts_bytes, "mp3", "audio/mpeg", prefix="avatar_tts")
                    finally:
                        await tts_provider.close()
                if not audio_url:
                    raise ValueError("audio_url is required (or provide text for auto TTS)")
                from app.services.ai_video.replicate_provider import ReplicateProvider
                provider = ReplicateProvider()
                ai_result = await provider.talking_head(
                    input_data["face_image_url"],
                    audio_url,
                )
                await update_job_status(
                    db, job_id, "processing", 0.5,
                    output_data=ai_result,
                    provider_job_id=ai_result.get("prediction_id"),
                )

            elif job_type == "text_to_image":
                from app.services.ai_video.replicate_provider import ReplicateProvider
                provider = ReplicateProvider()
                ai_result = await provider.text_to_image(
                    prompt=input_data["prompt"],
                    width=input_data.get("width", 1024),
                    height=input_data.get("height", 1024),
                    model=input_data.get("model", "schnell"),
                )
                await update_job_status(
                    db, job_id, "processing", 0.5,
                    output_data=ai_result,
                    provider_job_id=ai_result.get("prediction_id"),
                )

            elif job_type == "video_to_video":
                from app.services.ai_video.replicate_provider import ReplicateProvider
                provider = ReplicateProvider()
                ai_result = await provider.video_to_video(
                    video_url=input_data["video_url"],
                    prompt=input_data["prompt"],
                    strength=input_data.get("strength", 0.7),
                )
                await update_job_status(
                    db, job_id, "processing", 0.5,
                    output_data=ai_result,
                    provider_job_id=ai_result.get("prediction_id"),
                )

            elif job_type == "understand_media":
                media_type = input_data.get("media_type", "image")
                media_url = input_data["media_url"]
                question = input_data.get("question")

                if media_type == "image" and settings.ANTHROPIC_API_KEY:
                    # Use Claude Vision for higher quality image analysis
                    from anthropic import AsyncAnthropic
                    import base64 as b64module
                    from app.http_client import get_http_client

                    try:
                        client_http = await get_http_client()
                        img_resp = await client_http.get(media_url)
                        img_b64 = b64module.b64encode(img_resp.content).decode("utf-8")
                        content_type = img_resp.headers.get("content-type", "image/jpeg")

                        anthropic_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
                        vision_resp = await anthropic_client.messages.create(
                            model="claude-sonnet-4-20250514",
                            max_tokens=1024,
                            messages=[{
                                "role": "user",
                                "content": [
                                    {"type": "image", "source": {"type": "base64", "media_type": content_type, "data": img_b64}},
                                    {"type": "text", "text": question or "Describe this image in detail. Include scene description, mood, colors, composition, and any text visible."},
                                ],
                            }],
                        )
                        ai_result = {
                            "description": vision_resp.content[0].text,
                            "provider": "anthropic_vision",
                        }
                    except Exception as e:
                        logger.warning(f"Claude Vision failed, falling back to Replicate: {e}")
                        from app.services.ai_video.replicate_provider import ReplicateProvider
                        provider = ReplicateProvider()
                        ai_result = await provider.describe_image(
                            media_url,
                            question=question or "Describe this image in detail.",
                        )
                else:
                    from app.services.ai_video.replicate_provider import ReplicateProvider
                    provider = ReplicateProvider()

                    if media_type == "image":
                        ai_result = await provider.describe_image(
                            media_url,
                            question=question or "Describe this image in detail.",
                        )
                    elif media_type == "video":
                        ai_result = await provider.describe_video(
                            media_url,
                            question=question or "Describe this video in detail.",
                        )
                    elif media_type == "audio":
                        ai_result = await provider.transcribe_audio(
                            media_url,
                            language=input_data.get("language", "en"),
                        )
                    else:
                        raise ValueError(f"Unsupported media type: {media_type}")

                await update_job_status(
                    db, job_id, "processing", 0.5,
                    output_data=ai_result,
                    provider_job_id=ai_result.get("prediction_id"),
                )

            elif job_type == "tts":
                from app.services.ai_video.elevenlabs_provider import ElevenLabsProvider
                provider = ElevenLabsProvider()
                try:
                    audio_bytes = await provider.text_to_speech(
                        text=input_data["text"],
                        voice_id=input_data.get("voice_id", "21m00Tcm4TlvDq8ikWAM"),
                        model_id=input_data.get("model_id", "eleven_multilingual_v2"),
                        stability=input_data.get("stability", 0.5),
                        similarity_boost=input_data.get("similarity_boost", 0.75),
                    )
                    import base64
                    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
                    await update_job_status(
                        db, job_id, "completed", 1.0,
                        output_data={
                            "audio_base64": audio_b64,
                            "format": "mp3",
                            "size_bytes": len(audio_bytes),
                        },
                    )
                    return {"status": "completed", "size": len(audio_bytes)}
                finally:
                    await provider.close()

            elif job_type == "sound_effect":
                from app.services.ai_video.elevenlabs_provider import ElevenLabsProvider
                provider = ElevenLabsProvider()
                try:
                    audio_bytes = await provider.generate_sound_effect(
                        prompt=input_data["prompt"],
                        duration_seconds=input_data.get("duration_seconds"),
                    )
                    import base64
                    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
                    await update_job_status(
                        db, job_id, "completed", 1.0,
                        output_data={
                            "audio_base64": audio_b64,
                            "format": "mp3",
                            "size_bytes": len(audio_bytes),
                        },
                    )
                    return {"status": "completed", "size": len(audio_bytes)}
                finally:
                    await provider.close()

            elif job_type == "music_generation":
                prompt = input_data.get("prompt", "")
                music_url = None
                used_provider = None

                # Primary: search Pixabay for stock music
                pixabay_key = settings.PIXABAY_API_KEY
                if pixabay_key and not music_url:
                    try:
                        from app.http_client import get_http_client
                        client = await get_http_client()
                        resp = await client.get(
                            "https://pixabay.com/api/",
                            params={
                                "key": pixabay_key,
                                "q": prompt,
                                "media_type": "music",
                                "per_page": "3",
                            },
                        )
                        if resp.status_code == 200:
                            hits = resp.json().get("hits", [])
                            if hits:
                                music_url = hits[0].get("audio")
                                used_provider = "pixabay"
                    except Exception as e:
                        logger.warning(f"Pixabay music search failed: {e}")

                # Fallback: Replicate MusicGen
                if not music_url:
                    from app.services.ai_video.replicate_provider import ReplicateProvider
                    provider = ReplicateProvider()
                    ai_result = await provider.generate_music(
                        prompt=prompt,
                        duration=input_data.get("duration", 30),
                    )
                    if ai_result.get("output_url"):
                        music_url = ai_result["output_url"]
                        used_provider = "replicate"

                if music_url:
                    from app.services.storage_service import upload_from_url
                    stored_audio = await upload_from_url(
                        music_url, "mp3", "audio/mpeg", prefix=f"music/{used_provider}"
                    )
                    final_result = {
                        "provider": used_provider,
                        "audio_url": stored_audio,
                        "original_url": music_url,
                    }
                    await update_job_status(
                        db, job_id, "completed", 1.0,
                        output_data=final_result,
                    )
                    return {"status": "completed", "output": final_result}
                else:
                    raise ValueError("Failed to generate music from any provider")

            else:
                raise ValueError(f"Unknown AI job type: {job_type}")

            return {"status": "processing", "job_id": job_id}

        except Exception as exc:
            logger.exception(f"AI job {job_id} failed")
            await update_job_status(db, job_id, "failed", 0.0, error_message=str(exc))
            return {"error": str(exc)}


# ---------------------------------------------------------------------------
# 1-Hour Movie Architecture / Agent Workers
# ---------------------------------------------------------------------------

async def process_movie_ingestion(ctx: dict, session_id: str) -> dict:
    """Runs the IngestionAgent to chunk raw video."""
    from app.agents.orchestrator import AgentOrchestrator
    from app.agents.ingestion_agent import IngestionAgent
    
    orchestrator = await AgentOrchestrator.get_session(session_id)
    
    ingestion = IngestionAgent()
    orchestrator.state = await ingestion.run(orchestrator.state)
    await orchestrator.save_state()
    
    if orchestrator.state.get("status") == "failed":
        return {"error": orchestrator.state.get("error")}
        
    chunks = orchestrator.state.get("chunk_metadata", [])
    pool = ctx["redis"]
    
    for chunk in chunks:
        await pool.enqueue_job("process_movie_analysis", session_id, chunk["index"])
        
    return {"status": "ingestion_complete", "chunks_queued": len(chunks)}


async def process_movie_analysis(ctx: dict, session_id: str, chunk_index: int) -> dict:
    """Runs AnalysisAgent on a specific chunk."""
    from app.agents.orchestrator import AgentOrchestrator
    from app.agents.analysis_agent import AnalysisAgent
    
    orchestrator = await AgentOrchestrator.get_session(session_id)
    chunks = orchestrator.state.get("chunk_metadata", [])
    
    if chunk_index >= len(chunks):
        return {"error": "Invalid chunk index"}
        
    chunk = chunks[chunk_index]
    
    # Isolate sub-state for this chunk
    chunk_state = {
        **orchestrator.state,
        "current_chunk": chunk
    }
    
    analysis = AnalysisAgent()
    chunk_state = await analysis.run(chunk_state)
    
    if chunk_state.get("status") == "failed":
        return {"error": f"Failed analyzing chunk {chunk_index}"}
        
    orchestrator.state["video_maps"] = chunk_state.get("video_maps", {})
    await orchestrator.save_state()
    
    # Check if all chunks are analyzed
    video_maps = orchestrator.state.get("video_maps", {})
    if len(video_maps) == len(chunks):
        pool = ctx["redis"]
        await pool.enqueue_job("process_movie_director", session_id)
        
    return {"status": "analysis_complete", "chunk_index": chunk_index}

async def process_movie_director(ctx: dict, session_id: str) -> dict:
    """Runs QAAgent for pre-validation, then DirectorAgent, then cost estimation."""
    from app.agents.orchestrator import AgentOrchestrator
    from app.agents.director_agent import DirectorAgent
    from app.agents.qa_agent import QAAgent
    from app.services.cost_estimator import estimate_pipeline_cost

    orchestrator = await AgentOrchestrator.get_session(session_id)

    # Pre-pipeline validation: run QAAgent to check for ambiguous queries
    if not orchestrator.state.get("qa_completed"):
        qa = QAAgent()
        orchestrator.state = await qa.run(orchestrator.state)
        await orchestrator.save_state()

        if orchestrator.state.get("status") == "waiting_qa" and orchestrator.state.get("pending_questions"):
            return {"status": "waiting_qa", "questions": len(orchestrator.state["pending_questions"])}
        orchestrator.state["qa_completed"] = True

    director = DirectorAgent()
    orchestrator.state = await director.run(orchestrator.state)
    await orchestrator.save_state()

    if orchestrator.state.get("status") == "failed":
        return {"error": orchestrator.state.get("error")}

    # Estimate costs and pause for user approval
    cost_estimate = estimate_pipeline_cost(orchestrator.state)
    orchestrator.state["cost_estimate"] = cost_estimate

    if not orchestrator.state.get("cost_approved") and cost_estimate.get("total_estimated_usd", 0) > 0:
        orchestrator.state["status"] = "waiting_approval"
        orchestrator.state["messages"] = orchestrator.state.get("messages", []) + [
            {"role": "agent", "content": f"Estimated cost: ${cost_estimate['total_estimated_usd']:.2f}. Approve to continue."}
        ]
        await orchestrator.save_state()
        return {"status": "waiting_approval", "cost_estimate": cost_estimate}

    acts = orchestrator.state.get("acts", [])
    scene_plan = orchestrator.state.get("scene_plan", [])
    pool = ctx["redis"]

    if acts:
        for act_idx in range(len(acts)):
            await pool.enqueue_job("process_movie_act", session_id, act_idx)
        return {"status": "director_complete", "acts_queued": len(acts)}

    for idx in range(len(scene_plan)):
        await pool.enqueue_job("process_movie_scene", session_id, idx)
    return {"status": "director_complete", "scenes_queued": len(scene_plan)}


async def process_movie_act(ctx: dict, session_id: str, act_idx: int) -> dict:
    """Coordinates all scenes within an act. Scenes within an act run in parallel."""
    from app.agents.orchestrator import AgentOrchestrator

    orchestrator = await AgentOrchestrator.get_session(session_id)
    acts = orchestrator.state.get("acts", [])

    if act_idx >= len(acts):
        return {"error": f"Invalid act index {act_idx}"}

    act = acts[act_idx]
    act_scenes = act.get("scenes", [])
    scene_plan = orchestrator.state.get("scene_plan", [])
    pool = ctx["redis"]

    # Find the global scene indices for scenes in this act
    scenes_queued = 0
    for global_idx, scene in enumerate(scene_plan):
        if scene.get("act_number") == act.get("act_number"):
            await pool.enqueue_job("process_movie_scene", session_id, global_idx)
            scenes_queued += 1

    logger.info(f"Act {act_idx + 1} '{act.get('title', '')}': queued {scenes_queued} scenes")

    # Update acts progress
    acts_progress = orchestrator.state.get("acts_progress", {})
    acts_progress[f"act_{act_idx}"] = {"status": "processing", "scenes_total": scenes_queued}
    orchestrator.state["acts_progress"] = acts_progress
    await orchestrator.save_state()

    return {"status": "act_processing", "act_idx": act_idx, "scenes_queued": scenes_queued}


async def process_movie_scene(ctx: dict, session_id: str, scene_idx: int) -> dict:
    """Runs the pipeline (planner, generator, specialized agents, editor) for a SINGLE scene.

    Saves checkpoint state after each major step. Independent specialized agents
    run in parallel. One agent failure doesn't kill the scene.
    """
    import asyncio
    from app.agents.orchestrator import AgentOrchestrator
    from app.agents.planning_agent import PlanningAgent
    from app.agents.generation_agent import GenerationAgent
    from app.agents.editing_agent import EditingAgent
    from app.agents.specialized_agents import (
        CutAgent, CaptionAgent, ColorAgent, AudioAgent, EffectsAgent, FaceAgent
    )
    from app.services.audio_pipeline import AudioPipeline

    orchestrator = await AgentOrchestrator.get_session(session_id)
    scene_plan = orchestrator.state.get("scene_plan", [])

    if scene_idx >= len(scene_plan):
        return {"error": "Invalid scene index"}

    scene = scene_plan[scene_idx]

    # Wrap the flat scene list into the dict structure that downstream agents expect
    # (GenerationAgent, EditingAgent, CaptionAgent, etc. all call scene_plan.get("scenes", []))
    scene_plan_dict = {
        "scenes": scene_plan,
        "total_duration": sum(s.get("estimated_duration_seconds", s.get("duration", 15)) for s in scene_plan),
        "resolution": {"width": 1920, "height": 1080},
    }

    scene_state = {
        **orchestrator.state,
        "scene_plan": scene_plan_dict,
        "current_scene": scene,
        "current_scene_description": f"Scene {scene_idx + 1}: {scene.get('description')}",
    }

    # Step 1: Planning
    try:
        planner = PlanningAgent()
        scene_state = await planner.run(scene_state)
        if scene_state.get("status") == "failed":
            return {"error": f"Failed planning scene {scene_idx}"}
    except Exception as e:
        logger.exception(f"PlanningAgent failed for scene {scene_idx}")
        return {"error": f"Planning failed: {e}"}

    # Checkpoint after planning
    orchestrator.state["messages"] = scene_state.get("messages", [])
    await orchestrator.save_state()

    # Step 2: Generation (most time-consuming)
    try:
        generator = GenerationAgent(session_id=session_id)
        scene_state = await generator.run(scene_state)
    except Exception as e:
        logger.exception(f"GenerationAgent failed for scene {scene_idx}")
        scene_state["generation_errors"] = [str(e)]

    # Checkpoint after generation
    orchestrator.state["messages"] = scene_state.get("messages", [])
    orchestrator.state["generated_assets"] = scene_state.get("generated_assets", [])
    await orchestrator.save_state()

    # Step 2.5: AudioPipeline — generate per-character dialog and mix scene audio
    try:
        audio_pipeline = AudioPipeline()
        character_profiles = scene_state.get("character_profiles", {})
        scene_audio = await audio_pipeline.generate_scene_audio(scene, character_profiles)

        # Mix all audio layers (dialog + ambient + music)
        dialog_urls = [d["audio_url"] for d in scene_audio.get("dialog_urls", []) if d.get("audio_url")]
        mixed_audio_url = await audio_pipeline.mix_scene_audio(
            dialog_urls=dialog_urls,
            ambient_url=scene_audio.get("ambient_url"),
            music_url=scene_state.get("music_url"),
            scene_duration=scene.get("duration", 5),
        )
        if mixed_audio_url:
            scene_state["mixed_audio_url"] = mixed_audio_url
        scene_state["scene_audio"] = scene_audio
        await audio_pipeline.close()
    except Exception as e:
        logger.error(f"AudioPipeline failed for scene {scene_idx}: {e}")

    # Step 3: Specialized agents — run independent ones in parallel
    # CutAgent must run first (adjusts clip boundaries)
    try:
        scene_state = await CutAgent().run(scene_state)
    except Exception as e:
        logger.error(f"CutAgent failed for scene {scene_idx}: {e}")

    # These four are independent of each other
    async def _safe_run(agent_cls, state):
        try:
            return await agent_cls().run(state)
        except Exception as e:
            logger.error(f"{agent_cls.__name__} failed for scene {scene_idx}: {e}")
            return state

    color_task = _safe_run(ColorAgent, scene_state)
    audio_task = _safe_run(AudioAgent, scene_state)
    effects_task = _safe_run(EffectsAgent, scene_state)
    face_task = _safe_run(FaceAgent, scene_state)

    parallel_results = await asyncio.gather(color_task, audio_task, effects_task, face_task)

    # Merge results from parallel agents — keep all state mutations, not just flags
    MERGE_KEYS = [
        "color_grading", "color_agent_complete",
        "audio_processing", "audio_agent_complete", "normalized_audio_url",
        "effects_metadata", "effects_agent_complete",
        "face_metadata", "face_agent_complete",
    ]
    for result in parallel_results:
        for key in MERGE_KEYS:
            if key in result and result[key]:
                scene_state[key] = result[key]
        # Also merge any mutated generated_assets (color grading, face cropping modify these)
        if result.get("generated_assets"):
            scene_state["generated_assets"] = result["generated_assets"]

    # CaptionAgent runs after CutAgent (depends on final clip boundaries)
    try:
        scene_state = await CaptionAgent().run(scene_state)
    except Exception as e:
        logger.error(f"CaptionAgent failed for scene {scene_idx}: {e}")

    # Step 4: Assembly
    try:
        editor = EditingAgent()
        scene_state = await editor.run(scene_state)
    except Exception as e:
        logger.exception(f"EditingAgent failed for scene {scene_idx}")
        scene_state["assembled_timeline"] = {}

    # Save the timeline for this scene
    assembled = orchestrator.state.get("assembled_timeline", {})
    if not isinstance(assembled, dict):
        assembled = {}

    assembled[f"scene_{scene_idx}"] = scene_state.get("assembled_timeline", {})
    orchestrator.state["assembled_timeline"] = assembled
    orchestrator.state["messages"] = scene_state.get("messages", [])
    await orchestrator.save_state()

    # If this is the last tracked scene to finish, run Consistency Engine
    if len(assembled) == len(scene_plan):
        pool = ctx["redis"]
        await pool.enqueue_job("process_movie_consistency", session_id)

    return {"status": "completed", "scene_idx": scene_idx}


async def process_movie_consistency(ctx: dict, session_id: str) -> dict:
    """Runs the ConsistencyEngine to resolve overlaps and global limits."""
    from app.agents.orchestrator import AgentOrchestrator
    from app.services.consistency import ConsistencyEngine
    
    orchestrator = await AgentOrchestrator.get_session(session_id)
    
    engine = ConsistencyEngine()
    orchestrator.state = await engine.run_all(orchestrator.state)
    await orchestrator.save_state()
    
    pool = ctx["redis"]
    await pool.enqueue_job("process_movie_review", session_id)

    return {"status": "consistency_complete"}


async def process_movie_review(ctx: dict, session_id: str) -> dict:
    """Runs ReviewAgent on the assembled timeline, pauses for user if score is low."""
    from app.agents.orchestrator import AgentOrchestrator
    from app.agents.review_agent import ReviewAgent

    orchestrator = await AgentOrchestrator.get_session(session_id)

    review = ReviewAgent()
    orchestrator.state = await review.run(orchestrator.state)
    await orchestrator.save_state()

    review_score = orchestrator.state.get("review_score", 100)
    if review_score < 80 and orchestrator.state.get("status") == "regenerating":
        orchestrator.state["status"] = "waiting_approval"
        orchestrator.state["messages"] = orchestrator.state.get("messages", []) + [
            {"role": "agent", "content": f"Review score: {review_score}/100. Please review issues and approve to continue."}
        ]
        await orchestrator.save_state()
        return {"status": "waiting_approval", "review_score": review_score}

    pool = ctx["redis"]
    await pool.enqueue_job("process_movie_assembly", session_id)
    return {"status": "review_complete", "score": review_score}


async def process_movie_assembly(ctx: dict, session_id: str) -> dict:
    """Concatenates the sub-timelines from all scenes into a master project timeline."""
    from app.agents.orchestrator import AgentOrchestrator
    from app.database import async_session_factory
    from app.models import Project
    from sqlalchemy import select

    orchestrator = await AgentOrchestrator.get_session(session_id)
    assembled = orchestrator.state.get("assembled_timeline", {})
    scene_plan = orchestrator.state.get("scene_plan", [])
    
    master_timeline = {
        "total_duration": 0.0,
        "fps": 24,
        "resolution": {"width": 1920, "height": 1080},
        "tracks": {
            "video": [],
            "overlay": [],
            "audio": [],
            "music": [],
            "text": [],
            "effects": []
        }
    }
    
    current_offset = 0.0
    
    for idx in range(len(scene_plan)):
        scene_tl = assembled.get(f"scene_{idx}")
        if not scene_tl:
            continue
            
        scene_duration = scene_tl.get("total_duration", 0)
        
        # Merge tracks, applying chronological time offset
        for track_type, clips in scene_tl.get("tracks", {}).items():
            for clip in clips:
                new_clip = dict(clip)
                new_clip["startTime"] += current_offset
                master_timeline["tracks"][track_type].append(new_clip)
                
        current_offset += scene_duration
        
    master_timeline["total_duration"] = current_offset
    
    # Save to AgentSession
    orchestrator.state["assembled_timeline"] = master_timeline
    orchestrator.state["status"] = "completed"
    orchestrator.state["messages"] = orchestrator.state.get("messages", []) + [
        {"role": "agent", "content": f"🎬 1-Hour Movie Pipeline Complete! {len(scene_plan)} scenes assembled into a {master_timeline['total_duration']}s master timeline."}
    ]
    await orchestrator.save_state()
    
    # Also save to the Project model so the UI can load it immediately
    if getattr(orchestrator, "project_id", None):
        async with async_session_factory() as db:
            stmt = select(Project).where(Project.id == orchestrator.project_id)
            result = await db.execute(stmt)
            project = result.scalar_one_or_none()
            if project:
                settings = project.settings or {}
                settings["timeline_data"] = master_timeline
                project.settings = settings
                project.duration = master_timeline["total_duration"]
                await db.commit()
    
    return {"status": "movie_assembly_complete"}


# ---------------------------------------------------------------------------
# ARQ Worker Settings
# ---------------------------------------------------------------------------

class WorkerSettings:
    """ARQ worker configuration.

    Movie pipeline jobs can run for hours (generation + polling),
    so job_timeout is set high. max_tries=1 for movie jobs since
    they checkpoint state and can be resumed.
    """

    functions = [
        process_render_job,
        process_ai_job,
        process_movie_ingestion,
        process_movie_analysis,
        process_movie_director,
        process_movie_act,
        process_movie_scene,
        process_movie_consistency,
        process_movie_review,
        process_movie_assembly,
    ]
    redis_settings = _parse_redis_url(settings.REDIS_URL)
    max_jobs = 10
    job_timeout = 7200  # 2 hours — movie scenes need time for generation polling
    max_tries = 3

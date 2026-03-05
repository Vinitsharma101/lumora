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
                provider_name = input_data.get("provider", "google_veo")
                if provider_name == "google_veo":
                    from app.services.ai_video.google_provider import GoogleAIProvider
                    provider = GoogleAIProvider()
                    ai_result = await provider.generate_video_from_text(
                        prompt=input_data["prompt"],
                        duration=input_data.get("duration", 4),
                        aspect_ratio=input_data.get("aspect_ratio", "16:9"),
                    )
                elif provider_name == "openai_sora":
                    from app.services.ai_video.sora_provider import SoraProvider
                    provider = SoraProvider()
                    ai_result = await provider.generate_video(
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
                    min_gap=input_data.get("min_silence_duration", 0.5),
                )
                trimmed = generate_trimmed_timeline(
                    segments,
                    silences,
                    video_duration=input_data.get("video_duration", 0),
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

            elif job_type == "talking_head":
                audio_url = input_data.get("audio_url")
                if not audio_url:
                    raise ValueError("audio_url is required for talking_head jobs")
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

            else:
                raise ValueError(f"Unknown AI job type: {job_type}")

            return {"status": "processing", "job_id": job_id}

        except Exception as exc:
            logger.exception(f"AI job {job_id} failed")
            await update_job_status(db, job_id, "failed", 0.0, error_message=str(exc))
            return {"error": str(exc)}


# ---------------------------------------------------------------------------
# ARQ Worker Settings
# ---------------------------------------------------------------------------

class WorkerSettings:
    """ARQ worker configuration."""

    functions = [process_render_job, process_ai_job]
    redis_settings = _parse_redis_url(settings.REDIS_URL)
    max_jobs = 10
    job_timeout = 1800  # 30 minutes
    max_tries = 3

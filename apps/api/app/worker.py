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
    """Runs the DirectorAgent to create the ShowBible and split scenes, then enqueues scene jobs."""
    from app.agents.orchestrator import AgentOrchestrator
    from app.agents.director_agent import DirectorAgent
    
    orchestrator = await AgentOrchestrator.get_session(session_id)
    
    director = DirectorAgent()
    orchestrator.state = await director.run(orchestrator.state)
    await orchestrator.save_state()
    
    if orchestrator.state.get("status") == "failed":
        return {"error": orchestrator.state.get("error")}
        
    scene_plan = orchestrator.state.get("scene_plan", [])
    pool = ctx["redis"] # ARQ Redis pool instance is available in context
    
    for idx, scene in enumerate(scene_plan):
        await pool.enqueue_job("process_movie_scene", session_id, idx)
        
    return {"status": "director_complete", "scenes_queued": len(scene_plan)}


async def process_movie_scene(ctx: dict, session_id: str, scene_idx: int) -> dict:
    """Runs the pipeline (planner, generator, editor) for a SINGLE chunk/scene."""
    from app.agents.orchestrator import AgentOrchestrator
    from app.agents.planning_agent import PlanningAgent
    from app.agents.generation_agent import GenerationAgent
    from app.agents.editing_agent import EditingAgent
    
    orchestrator = await AgentOrchestrator.get_session(session_id)
    scene_plan = orchestrator.state.get("scene_plan", [])
    
    if scene_idx >= len(scene_plan):
        return {"error": "Invalid scene index"}
        
    scene = scene_plan[scene_idx]
    
    # Isolate sub-state for just this scene
    scene_state = {
        **orchestrator.state,
        "current_scene": scene,
        "original_query": f"Scene {scene_idx + 1}: {scene.get('description')}"
    }
    
    planner = PlanningAgent()
    scene_state = await planner.run(scene_state)
    if scene_state.get("status") == "failed":
        return {"error": f"Failed planning scene {scene_idx}"}
        
    generator = GenerationAgent()
    scene_state = await generator.run(scene_state)
    
    from app.agents.specialized_agents import (
        CutAgent, CaptionAgent, ColorAgent, AudioAgent, EffectsAgent, FaceAgent
    )
    
    # Run specialized edit agents pool
    scene_state = await CutAgent().run(scene_state)
    scene_state = await CaptionAgent().run(scene_state)
    scene_state = await ColorAgent().run(scene_state)
    scene_state = await AudioAgent().run(scene_state)
    scene_state = await EffectsAgent().run(scene_state)
    scene_state = await FaceAgent().run(scene_state)
    
    # Save the timeline for this scene
    assembled = orchestrator.state.get("assembled_timeline", {})
    if not isinstance(assembled, dict):
        assembled = {}
        
    assembled[f"scene_{scene_idx}"] = scene_state.get("assembled_timeline", {})
    orchestrator.state["assembled_timeline"] = assembled
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
    
    pool = ctx["redis"] # Proceed to assembly
    await pool.enqueue_job("process_movie_assembly", session_id)
    
    return {"status": "consistency_complete"}


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
    """ARQ worker configuration."""

    functions = [
        process_render_job, 
        process_ai_job, 
        process_movie_ingestion,
        process_movie_analysis,
        process_movie_director, 
        process_movie_scene, 
        process_movie_consistency,
        process_movie_assembly
    ]
    redis_settings = _parse_redis_url(settings.REDIS_URL)
    max_jobs = 10
    job_timeout = 1800  # 30 minutes
    max_tries = 3

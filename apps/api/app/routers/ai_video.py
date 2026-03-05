"""AI video generation API endpoints.

All generation uses cloud APIs — no local models:
- Google Veo (text-to-video, image-to-video)
- OpenAI Sora (text-to-video)
- Replicate (Stable Video Diffusion, FLUX image gen, upscaling, background removal, style transfer, media understanding)
- ElevenLabs (voice/TTS for avatars, sound effects)
"""

from datetime import datetime, timezone
from uuid import uuid4

import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import AIJob, User
from app.rate_limit import check_rate_limit
from app.schemas.ai_video import (
    AIJobResponse,
    AIJobStatusResponse,
    BackgroundRemoveRequest,
    ImageToVideoRequest,
    MediaUnderstandRequest,
    ScriptToScenesRequest,
    SoundEffectRequest,
    StyleTransferRequest,
    TextToImageRequest,
    TextToVideoRequest,
    TTSRequest,
    UpscaleRequest,
    VideoToVideoRequest,
    AIAvatarRequest,
)
from app.services.auto_edit.pipeline import create_auto_edit_job as create_ai_job
from app.worker import enqueue_ai_job

router = APIRouter(tags=["ai-video"])


@router.post("/api/ai/video/text-to-video", response_model=AIJobResponse)
async def text_to_video(
    body: TextToVideoRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate video from a text prompt using cloud AI models."""
    await check_rate_limit(request)

    job = await create_ai_job(
        db=db,
        user_id=user.id,
        job_type="text_to_video",
        input_data={
            "prompt": body.prompt,
            "duration": body.duration,
            "aspect_ratio": body.aspect_ratio,
            "style": body.style,
            "provider": body.provider,
        },
        project_id=body.project_id,
        provider=body.provider,
    )

    await enqueue_ai_job(job.id, "text_to_video")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


@router.post("/api/ai/video/image-to-video", response_model=AIJobResponse)
async def image_to_video(
    body: ImageToVideoRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate video from an image using cloud AI models."""
    await check_rate_limit(request)

    job = await create_ai_job(
        db=db,
        user_id=user.id,
        job_type="image_to_video",
        input_data={
            "image_url": body.image_url,
            "prompt": body.prompt,
            "duration": body.duration,
            "provider": body.provider,
        },
        project_id=body.project_id,
        provider=body.provider,
    )

    await enqueue_ai_job(job.id, "image_to_video")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


@router.post("/api/ai/video/script-to-scenes")
async def script_to_scenes(
    body: ScriptToScenesRequest,
    request: Request,
    user: User = Depends(get_current_user),
):
    """Break a script into storyboard scenes using LLM, then optionally generate videos.

    This is a synchronous call for the scene planning step.
    Video generation for each scene is queued as separate jobs.
    """
    await check_rate_limit(request)

    from app.services.ai_video.scene_planner import plan_scenes_from_script

    storyboard = await plan_scenes_from_script(
        script=body.script,
        style=body.style,
        aspect_ratio=body.aspect_ratio,
    )

    return storyboard


@router.post("/api/ai/video/background-remove", response_model=AIJobResponse)
async def background_remove(
    body: BackgroundRemoveRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove background from an image or video using cloud AI."""
    await check_rate_limit(request)

    url = body.image_url or body.video_url
    if not url:
        raise HTTPException(status_code=400, detail="Provide image_url or video_url")

    job = await create_ai_job(
        db=db,
        user_id=user.id,
        job_type="background_remove",
        input_data={"image_url": body.image_url, "video_url": body.video_url},
        project_id=body.project_id,
        provider="replicate",
    )

    await enqueue_ai_job(job.id, "background_remove")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


@router.post("/api/ai/video/upscale", response_model=AIJobResponse)
async def upscale(
    body: UpscaleRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upscale an image or video using Real-ESRGAN via Replicate."""
    await check_rate_limit(request)

    url = body.image_url or body.video_url
    if not url:
        raise HTTPException(status_code=400, detail="Provide image_url or video_url")

    job = await create_ai_job(
        db=db,
        user_id=user.id,
        job_type="upscale",
        input_data={"image_url": body.image_url, "video_url": body.video_url, "scale": body.scale},
        project_id=body.project_id,
        provider="replicate",
    )

    await enqueue_ai_job(job.id, "upscale")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


@router.post("/api/ai/video/style-transfer", response_model=AIJobResponse)
async def style_transfer(
    body: StyleTransferRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply AI style transfer to a video via Replicate."""
    await check_rate_limit(request)

    job = await create_ai_job(
        db=db,
        user_id=user.id,
        job_type="style_transfer",
        input_data={
            "video_url": body.video_url,
            "style_prompt": body.style_prompt,
            "strength": body.strength,
        },
        project_id=body.project_id,
        provider="replicate",
    )

    await enqueue_ai_job(job.id, "style_transfer")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


@router.post("/api/ai/video/avatar", response_model=AIJobResponse)
async def generate_avatar(
    body: AIAvatarRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a talking head AI avatar from a face image + audio/text."""
    await check_rate_limit(request)

    # If text provided instead of audio, generate audio via ElevenLabs first
    audio_url = body.audio_url
    if not audio_url and body.text:
        # This will be handled in the worker —  generate TTS first, then talking head
        pass

    job = await create_ai_job(
        db=db,
        user_id=user.id,
        job_type="talking_head",
        input_data={
            "face_image_url": body.face_image_url,
            "audio_url": audio_url,
            "text": body.text,
            "voice_id": body.voice_id,
        },
        project_id=body.project_id,
        provider="replicate",
    )

    await enqueue_ai_job(job.id, "talking_head")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


# ── Text-to-Image (FLUX via Replicate) ──


@router.post("/api/ai/video/text-to-image", response_model=AIJobResponse)
async def text_to_image(
    body: TextToImageRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate an image from a text prompt using FLUX models via Replicate."""
    await check_rate_limit(request)

    job = await create_ai_job(
        db=db,
        user_id=user.id,
        job_type="text_to_image",
        input_data={
            "prompt": body.prompt,
            "width": body.width,
            "height": body.height,
            "model": body.model,
            "style": body.style,
        },
        project_id=body.project_id,
        provider="replicate",
    )

    await enqueue_ai_job(job.id, "text_to_image")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


# ── Video-to-Video ──


@router.post("/api/ai/video/video-to-video", response_model=AIJobResponse)
async def video_to_video(
    body: VideoToVideoRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Transform a video using AI-driven style transfer."""
    await check_rate_limit(request)

    job = await create_ai_job(
        db=db,
        user_id=user.id,
        job_type="video_to_video",
        input_data={
            "video_url": body.video_url,
            "prompt": body.prompt,
            "strength": body.strength,
            "provider": body.provider,
        },
        project_id=body.project_id,
        provider=body.provider,
    )

    await enqueue_ai_job(job.id, "video_to_video")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


# ── Media Understanding (Image/Video/Audio) ──


@router.post("/api/ai/video/understand-media", response_model=AIJobResponse)
async def understand_media(
    body: MediaUnderstandRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analyze and describe uploaded media using AI vision/audio models."""
    await check_rate_limit(request)

    job = await create_ai_job(
        db=db,
        user_id=user.id,
        job_type="understand_media",
        input_data={
            "media_url": body.media_url,
            "media_type": body.media_type,
            "question": body.question,
        },
        project_id=body.project_id,
        provider="replicate",
    )

    await enqueue_ai_job(job.id, "understand_media")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


# ── ElevenLabs TTS ──


@router.post("/api/ai/voice/tts", response_model=AIJobResponse)
async def text_to_speech(
    body: TTSRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate speech audio from text using ElevenLabs."""
    await check_rate_limit(request)

    job = await create_ai_job(
        db=db,
        user_id=user.id,
        job_type="tts",
        input_data={
            "text": body.text,
            "voice_id": body.voice_id,
            "model_id": body.model_id,
            "stability": body.stability,
            "similarity_boost": body.similarity_boost,
        },
        project_id=body.project_id,
        provider="elevenlabs",
    )

    await enqueue_ai_job(job.id, "tts")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


# ── ElevenLabs Sound Effects ──


@router.post("/api/ai/voice/sfx", response_model=AIJobResponse)
async def generate_sound_effect(
    body: SoundEffectRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a sound effect from a text description using ElevenLabs."""
    await check_rate_limit(request)

    job = await create_ai_job(
        db=db,
        user_id=user.id,
        job_type="sound_effect",
        input_data={
            "prompt": body.prompt,
            "duration_seconds": body.duration_seconds,
        },
        project_id=body.project_id,
        provider="elevenlabs",
    )

    await enqueue_ai_job(job.id, "sound_effect")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


# ── ElevenLabs Voice Listing ──


@router.get("/api/ai/voice/voices")
async def list_voices(
    request: Request,
    user: User = Depends(get_current_user),
):
    """List all available ElevenLabs voices."""
    await check_rate_limit(request)

    from app.services.ai_video.elevenlabs_provider import ElevenLabsProvider
    provider = ElevenLabsProvider()
    try:
        result = await provider.list_voices()
        return result
    finally:
        await provider.close()

@router.get("/api/ai/jobs/{job_id}", response_model=AIJobStatusResponse)
async def get_ai_job_status(
    job_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check the status of any AI job."""
    await check_rate_limit(request)

    stmt = select(AIJob).where(AIJob.id == job_id, AIJob.user_id == user.id)
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="AI job not found")

    # If job is still processing and has a provider job ID, check upstream status
    if job.status == "processing" and job.provider_job_id:
        try:
            if job.provider == "replicate":
                from app.services.ai_video.replicate_provider import ReplicateProvider
                provider = ReplicateProvider()
                upstream = await provider.get_prediction_status(job.provider_job_id)
                if upstream["status"] == "succeeded":
                    job.status = "completed"
                    job.progress = 1.0
                    job.output_data = {"output": upstream["output"]}
                    job.completed_at = datetime.now(timezone.utc)
                    await db.commit()
                elif upstream["status"] == "failed":
                    job.status = "failed"
                    job.error_message = upstream.get("error", "Unknown error")
                    job.completed_at = datetime.now(timezone.utc)
                    await db.commit()

            elif job.provider == "google_veo":
                from app.services.ai_video.google_provider import GoogleAIProvider
                provider = GoogleAIProvider()
                upstream = await provider.check_operation(job.provider_job_id)
                if upstream["status"] == "completed":
                    job.status = "completed"
                    job.progress = 1.0
                    job.output_data = upstream
                    job.completed_at = datetime.now(timezone.utc)
                    await db.commit()

            elif job.provider == "openai_sora":
                from app.services.ai_video.sora_provider import SoraProvider
                provider = SoraProvider()
                upstream = await provider.check_generation(job.provider_job_id)
                if upstream["status"] == "completed":
                    job.status = "completed"
                    job.progress = 1.0
                    job.output_data = {"video_url": upstream.get("video_url")}
                    job.completed_at = datetime.now(timezone.utc)
                    await db.commit()
        except Exception:
            pass  # Don't fail status check if provider check fails

    return AIJobStatusResponse(
        id=job.id,
        job_type=job.job_type,
        status=job.status,
        progress=job.progress,
        error_message=job.error_message,
        input_data=job.input_data,
        output_data=job.output_data,
        provider=job.provider,
        current_step=job.current_step,
        chunks_total=job.chunks_total,
        chunks_completed=job.chunks_completed,
        output_url=job.output_url,
        created_at=job.created_at.isoformat(),
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
    )


@router.get("/api/ai/jobs", response_model=list[AIJobStatusResponse])
async def list_ai_jobs(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    project_id: str | None = None,
    job_type: str | None = None,
    status: str | None = None,
):
    """List AI jobs for the current user, optionally filtered."""
    await check_rate_limit(request)

    stmt = select(AIJob).where(AIJob.user_id == user.id)

    if project_id:
        stmt = stmt.where(AIJob.project_id == project_id)
    if job_type:
        stmt = stmt.where(AIJob.job_type == job_type)
    if status:
        stmt = stmt.where(AIJob.status == status)

    stmt = stmt.order_by(AIJob.created_at.desc()).limit(50)

    result = await db.execute(stmt)
    jobs = result.scalars().all()

    return [
        AIJobStatusResponse(
            id=j.id,
            job_type=j.job_type,
            status=j.status,
            progress=j.progress,
            error_message=j.error_message,
            input_data=j.input_data,
            output_data=j.output_data,
            provider=j.provider,
            current_step=j.current_step,
            chunks_total=j.chunks_total,
            chunks_completed=j.chunks_completed,
            output_url=j.output_url,
            created_at=j.created_at.isoformat(),
            completed_at=j.completed_at.isoformat() if j.completed_at else None,
        )
        for j in jobs
    ]

@router.websocket("/api/ai/jobs/{job_id}/ws")
async def ai_job_status_websocket(websocket: WebSocket, job_id: str, db: AsyncSession = Depends(get_db)):
    """Stream live progress of an AI job via WebSockets."""
    await websocket.accept()
    
    # We poll the DB every 2 seconds for status updates. In a truly scaled 
    # system we would use Redis Pub/Sub directly, but polling the DB is a 
    # safe baseline given PostgreSQL is tracking the job states.
    try:
        while True:
            stmt = select(AIJob).where(AIJob.id == job_id)
            result = await db.execute(stmt)
            job = result.scalar_one_or_none()
            
            if not job:
                await websocket.send_json({"error": "Job not found"})
                await websocket.close(code=1000)
                return
                
            response = AIJobStatusResponse(
                id=job.id,
                job_type=job.job_type,
                status=job.status,
                progress=job.progress,
                current_step=job.current_step,
                chunks_total=job.chunks_total,
                chunks_completed=job.chunks_completed,
                error_message=job.error_message,
                output_url=job.output_url,
                input_data=job.input_data,
                output_data=job.output_data,
                provider=job.provider,
                created_at=job.created_at.isoformat(),
                completed_at=job.completed_at.isoformat() if job.completed_at else None,
            )
            
            await websocket.send_json(response.model_dump())
            
            if job.status in ("completed", "failed"):
                await websocket.close(code=1000)
                break
                
            await asyncio.sleep(2)
            # Need to expire the session so we get fresh data from the DB
            # rather than cached sqlalchemy instances on next tick.
            db.expire(job) 

    except WebSocketDisconnect:
        print(f"Client disconnected from job stream {job_id}")
    except Exception as e:
        print(f"WebSocket Error: {e}")
        try:
            await websocket.close(code=1011)
        except Exception:
            pass

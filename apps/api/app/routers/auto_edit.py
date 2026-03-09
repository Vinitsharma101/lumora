"""AI auto-edit pipeline API endpoints.

All processing uses cloud APIs — no local models:
- Whisper transcription via Replicate
- Silence detection from transcript gaps
- Scene detection via Gemini Vision API
- Highlight detection via LLM
- Caption generation via LLM
- Beat sync via audio analysis API
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.rate_limit import check_rate_limit
from app.schemas.ai_video import (
    AIJobResponse,
    AutoCaptionsRequest,
    AutoEditAnalyzeRequest,
    AutoReframeRequest,
    BeatSyncRequest,
    CreateShortsRequest,
    SilenceRemoveRequest,
    VoiceDubRequest,
)
from app.services.auto_edit.pipeline import create_auto_edit_job
from app.worker import enqueue_ai_job

router = APIRouter(tags=["auto-edit"])


@router.post("/api/auto-edit/analyze", response_model=AIJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def analyze_video(
    body: AutoEditAnalyzeRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analyze a video for auto-editing: detect scenes, silence, highlights, and transcribe.

    This kicks off multiple sub-analyses and returns a job ID for tracking.
    """
    await check_rate_limit(request)

    job = await create_auto_edit_job(
        db=db,
        user_id=user.id,
        job_type="analyze_video",
        input_data={
            "video_url": body.video_url,
            "detect_scenes": body.detect_scenes,
            "detect_silence": body.detect_silence,
            "detect_highlights": body.detect_highlights,
            "transcribe": body.transcribe,
        },
        project_id=body.project_id,
    )

    # Kick off sub-jobs
    if body.transcribe or body.detect_silence:
        sub_job = await create_auto_edit_job(
            db=db,
            user_id=user.id,
            job_type="transcribe",
            input_data={"audio_url": body.video_url, "parent_job_id": job.id},
            project_id=body.project_id,
            provider="replicate",
        )
        await enqueue_ai_job(sub_job.id, "transcribe")

    if body.detect_scenes:
        sub_job = await create_auto_edit_job(
            db=db,
            user_id=user.id,
            job_type="scene_detect",
            input_data={"video_url": body.video_url, "parent_job_id": job.id},
            project_id=body.project_id,
            provider="google",
        )
        await enqueue_ai_job(sub_job.id, "scene_detect")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


@router.post("/api/auto-edit/silence-remove", response_model=AIJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def remove_silence(
    body: SilenceRemoveRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove silence from a video.

    1. Transcribes audio via Replicate Whisper
    2. Detects silence gaps from transcript
    3. Returns trimmed timeline clips
    """
    await check_rate_limit(request)

    job = await create_auto_edit_job(
        db=db,
        user_id=user.id,
        job_type="silence_remove",
        input_data={
            "video_url": body.video_url,
            "min_silence_duration": body.min_silence_duration,
            "silence_threshold": body.silence_threshold,
        },
        project_id=body.project_id,
        provider="replicate",
    )

    await enqueue_ai_job(job.id, "silence_remove")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


@router.post("/api/auto-edit/captions", response_model=AIJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_captions(
    body: AutoCaptionsRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate styled captions for a video.

    1. Transcribes audio via Replicate Whisper
    2. Formats captions with LLM styling (default, viral, karaoke, minimal)
    3. Returns timeline-ready caption elements
    """
    await check_rate_limit(request)

    job = await create_auto_edit_job(
        db=db,
        user_id=user.id,
        job_type="generate_captions",
        input_data={
            "video_url": body.video_url,
            "language": body.language,
            "style": body.style,
        },
        project_id=body.project_id,
        provider="replicate",
    )

    await enqueue_ai_job(job.id, "generate_captions")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


@router.post("/api/auto-edit/shorts", response_model=AIJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_shorts(
    body: CreateShortsRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Auto-generate short-form clips from a longer video.

    1. Analyzes video for scenes and transcript
    2. Detects highlight moments via LLM
    3. Returns clip suggestions with timecodes
    """
    await check_rate_limit(request)

    job = await create_auto_edit_job(
        db=db,
        user_id=user.id,
        job_type="create_shorts",
        input_data={
            "video_url": body.video_url,
            "max_duration": body.max_duration,
            "count": body.count,
            "aspect_ratio": body.aspect_ratio,
        },
        project_id=body.project_id,
    )

    await enqueue_ai_job(job.id, "create_shorts")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


@router.post("/api/auto-edit/beat-sync", response_model=AIJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def beat_sync(
    body: BeatSyncRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sync video cuts to music beats.

    Uses Replicate for audio analysis to detect beats,
    and LLM to plan optimal cut points.
    """
    await check_rate_limit(request)

    job = await create_auto_edit_job(
        db=db,
        user_id=user.id,
        job_type="beat_sync",
        input_data={
            "video_url": body.video_url,
            "music_url": body.music_url,
        },
        project_id=body.project_id,
    )

    await enqueue_ai_job(job.id, "beat_sync")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


@router.post("/api/auto-edit/reframe", response_model=AIJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def auto_reframe(
    body: AutoReframeRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Auto-reframe horizontal video to vertical aspect ratio.

    Uses Gemini Vision to detect subjects and create smart crop regions.
    """
    await check_rate_limit(request)

    job = await create_auto_edit_job(
        db=db,
        user_id=user.id,
        job_type="auto_reframe",
        input_data={
            "video_url": body.video_url,
            "target_aspect_ratio": body.target_aspect_ratio,
        },
        project_id=body.project_id,
        provider="google",
    )

    await enqueue_ai_job(job.id, "auto_reframe")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


@router.post("/api/auto-edit/voice-dub", response_model=AIJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def voice_dub(
    body: VoiceDubRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dub a video into another language.

    1. Transcribes via Replicate Whisper
    2. Translates text via LLM
    3. Generates dubbed audio via ElevenLabs
    4. Returns new audio track for timeline
    """
    await check_rate_limit(request)

    job = await create_auto_edit_job(
        db=db,
        user_id=user.id,
        job_type="voice_dub",
        input_data={
            "video_url": body.video_url,
            "target_language": body.target_language,
            "voice_id": body.voice_id,
        },
        project_id=body.project_id,
    )

    await enqueue_ai_job(job.id, "voice_dub")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )

import logging

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.rate_limit import check_rate_limit
from app.schemas.ai_video import AIJobResponse
from app.services.auto_edit.pipeline import create_auto_edit_job as create_ai_job
from app.worker import enqueue_ai_job

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ai"])


class TTSRequest(BaseModel):
    text: str
    voice_id: str | None = None
    model_id: str | None = None
    stability: float | None = None
    similarity_boost: float | None = None


class SFXRequest(BaseModel):
    prompt: str
    duration_seconds: float | None = None


@router.post("/api/ai/voice/tts", response_model=AIJobResponse)
async def text_to_speech(
    body: TTSRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate speech from text using ElevenLabs TTS."""
    await check_rate_limit(request)

    input_data: dict = {"text": body.text}
    if body.voice_id:
        input_data["voice_id"] = body.voice_id
    if body.model_id:
        input_data["model_id"] = body.model_id
    if body.stability is not None:
        input_data["stability"] = body.stability
    if body.similarity_boost is not None:
        input_data["similarity_boost"] = body.similarity_boost

    job = await create_ai_job(
        db=db,
        user_id=user.id,
        job_type="tts",
        input_data=input_data,
        project_id=None,
        provider="elevenlabs",
    )

    await enqueue_ai_job(job.id, "tts")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


@router.post("/api/ai/voice/sfx", response_model=AIJobResponse)
async def generate_sound_effect(
    body: SFXRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a sound effect from a text description using ElevenLabs."""
    await check_rate_limit(request)

    input_data: dict = {"prompt": body.prompt}
    if body.duration_seconds is not None:
        input_data["duration_seconds"] = body.duration_seconds

    job = await create_ai_job(
        db=db,
        user_id=user.id,
        job_type="sound_effect",
        input_data=input_data,
        project_id=None,
        provider="elevenlabs",
    )

    await enqueue_ai_job(job.id, "sound_effect")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )


@router.get("/api/ai/voice/voices")
async def list_voices(
    request: Request,
    user: User = Depends(get_current_user),
):
    """List available ElevenLabs voices."""
    await check_rate_limit(request)

    from app.services.ai_video.elevenlabs_provider import ElevenLabsProvider

    provider = ElevenLabsProvider()
    try:
        voices = await provider.list_voices()
        return {"voices": voices}
    finally:
        await provider.close()

import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.rate_limit import check_rate_limit
from app.schemas.ai import MusicRequest
from app.schemas.ai_video import AIJobResponse
from app.services.auto_edit.pipeline import create_auto_edit_job as create_ai_job
from app.worker import enqueue_ai_job

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ai"])

@router.post("/api/ai/music", response_model=AIJobResponse)
async def generate_music(
    body: MusicRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate background music using AI asynchronously."""
    await check_rate_limit(request)

    job = await create_ai_job(
        db=db,
        user_id=user.id,
        job_type="music_generation",
        input_data={
            "prompt": body.prompt,
            "duration": body.duration,
            "style": body.style,
        },
        project_id=None,
        provider="replicate",
    )

    await enqueue_ai_job(job.id, "music_generation")

    return AIJobResponse(
        job_id=job.id,
        status=job.status,
        job_type=job.job_type,
        progress=job.progress,
    )

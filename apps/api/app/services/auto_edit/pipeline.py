"""Auto-edit pipeline orchestrator.

Coordinates all auto-edit sub-tasks via cloud APIs — no local models.
- Silence detection: Replicate Whisper for transcription + gap analysis
- Scene detection: Replicate/Google API-based
- Highlight detection: LLM analysis of transcript + audio energy
- Caption generation: Whisper transcription + LLM formatting
- Beat sync: Audio analysis via API
"""

from datetime import datetime, timezone
from uuid import uuid4


def _utcnow() -> datetime:
    """Return a timezone-naive UTC datetime compatible with 'timestamp without time zone' columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AIJob


async def create_auto_edit_job(
    db: AsyncSession,
    user_id: str,
    job_type: str,
    input_data: dict,
    project_id: str | None = None,
    provider: str = "replicate",
) -> AIJob:
    """Create a tracked AI job for auto-edit operations."""
    now = _utcnow()
    job = AIJob(
        id=str(uuid4()),
        user_id=user_id,
        project_id=project_id,
        job_type=job_type,
        status="queued",
        progress=0.0,
        input_data=input_data,
        provider=provider,
        created_at=now,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


async def update_job_status(
    db: AsyncSession,
    job_id: str,
    status: str,
    progress: float = 0.0,
    output_data: dict | None = None,
    error_message: str | None = None,
    provider_job_id: str | None = None,
) -> None:
    """Update the status of an AI job."""
    from sqlalchemy import select

    stmt = select(AIJob).where(AIJob.id == job_id)
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    if not job:
        return

    job.status = status
    job.progress = progress
    if output_data is not None:
        job.output_data = output_data
    if error_message is not None:
        job.error_message = error_message
    if provider_job_id is not None:
        job.provider_job_id = provider_job_id
    if status in ("completed", "failed"):
        job.completed_at = _utcnow()

    await db.commit()

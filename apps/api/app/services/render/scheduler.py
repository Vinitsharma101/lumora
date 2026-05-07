"""Render job scheduler and management.

Enqueues render jobs to ARQ (async Redis queue) for processing.
Workers download media from Supabase, render via FFmpeg, upload results.
"""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RenderJob


async def create_render_job(
    db: AsyncSession,
    user_id: str,
    project_id: str,
    timeline_data: dict,
    format: str = "mp4",
    quality: str = "high",
    width: int = 1920,
    height: int = 1080,
    fps: int = 30,
) -> RenderJob:
    """Create a render job record and enqueue it."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    job = RenderJob(
        id=str(uuid4()),
        project_id=project_id,
        user_id=user_id,
        status="queued",
        progress=0.0,
        format=format,
        quality=quality,
        width=width,
        height=height,
        fps=fps,
        timeline_data=timeline_data,
        created_at=now,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Enqueue to ARQ
    from app.worker import enqueue_render_job

    await enqueue_render_job(job.id)

    return job


async def get_render_job(db: AsyncSession, job_id: str, user_id: str) -> RenderJob | None:
    """Get a render job by ID, scoped to user."""
    stmt = select(RenderJob).where(RenderJob.id == job_id, RenderJob.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def update_render_progress(
    db: AsyncSession,
    job_id: str,
    status: str,
    progress: float,
    output_url: str | None = None,
    output_size: int | None = None,
    error_message: str | None = None,
) -> None:
    """Update render job progress."""
    stmt = select(RenderJob).where(RenderJob.id == job_id)
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    if not job:
        return

    job.status = status
    job.progress = progress
    if output_url:
        job.output_url = output_url
    if output_size:
        job.output_size = output_size
    if error_message:
        job.error_message = error_message
    if status in ("completed", "failed"):
        job.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)

    await db.commit()

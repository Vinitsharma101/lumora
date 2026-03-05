"""Server-side render/export API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.rate_limit import check_rate_limit
from app.schemas.render import RenderJobResponse, RenderRequest
from app.services.render.scheduler import create_render_job, get_render_job
from app.supabase_client import get_storage_url, BUCKET_RENDERED_OUTPUTS

router = APIRouter(tags=["render"])


@router.post("/api/render", response_model=RenderJobResponse)
async def submit_render(
    body: RenderRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a project for server-side rendering.

    The render job runs in a background worker using FFmpeg.
    Poll GET /api/render/{job_id} for progress.
    """
    await check_rate_limit(request)

    # Get timeline data from project if not provided
    timeline_data = body.timeline_data
    if not timeline_data:
        from sqlalchemy import select
        from app.models import Project

        stmt = select(Project).where(Project.id == body.project_id, Project.user_id == user.id)
        result = await db.execute(stmt)
        project = result.scalar_one_or_none()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        timeline_data = {
            "scenes": project.scenes or [],
            "settings": project.settings or {},
        }

    job = await create_render_job(
        db=db,
        user_id=user.id,
        project_id=body.project_id,
        timeline_data=timeline_data,
        format=body.format,
        quality=body.quality,
        width=body.width,
        height=body.height,
        fps=body.fps,
    )

    return job


@router.get("/api/render/{job_id}", response_model=RenderJobResponse)
async def get_render_status(
    job_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the status and progress of a render job."""
    await check_rate_limit(request)

    job = await get_render_job(db, job_id, user.id)
    if not job:
        raise HTTPException(status_code=404, detail="Render job not found")

    # Refresh signed URL if completed
    if job.status == "completed" and job.output_url:
        try:
            storage_path = f"{user.id}/{job_id}/output.{job.format}"
            job.output_url = get_storage_url(BUCKET_RENDERED_OUTPUTS, storage_path, expires_in=86400 * 7)
        except Exception:
            pass

    return job


@router.get("/api/render/{job_id}/stream")
async def stream_render_progress(
    job_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream render progress updates via Server-Sent Events."""
    import asyncio
    import json

    # Verify job exists and user has access before starting SSE
    job = await get_render_job(db, job_id, user.id)
    if not job:
        raise HTTPException(status_code=404, detail="Render job not found")

    # Capture user_id so we don't depend on the request-scoped db session
    current_user_id = user.id

    async def event_generator():
        from app.database import async_session_factory

        while True:
            # Use a fresh session for each poll to avoid stale/closed session issues
            async with async_session_factory() as session:
                refreshed = await get_render_job(session, job_id, current_user_id)
                if not refreshed:
                    yield {"event": "error", "data": json.dumps({"error": "Job not found"})}
                    break

                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "status": refreshed.status,
                        "progress": refreshed.progress,
                        "output_url": refreshed.output_url,
                        "error_message": refreshed.error_message,
                    }),
                }

                if refreshed.status in ("completed", "failed"):
                    break

            await asyncio.sleep(2)

    return EventSourceResponse(event_generator())


@router.get("/api/render/{job_id}/download")
async def get_render_download(
    job_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a fresh download URL for a completed render."""
    await check_rate_limit(request)

    job = await get_render_job(db, job_id, user.id)
    if not job:
        raise HTTPException(status_code=404, detail="Render job not found")

    if job.status != "completed":
        raise HTTPException(status_code=400, detail="Render not yet completed")

    storage_path = f"{user.id}/{job_id}/output.{job.format}"
    url = get_storage_url(BUCKET_RENDERED_OUTPUTS, storage_path, expires_in=86400 * 7)

    return {"url": url, "size": job.output_size, "format": job.format}

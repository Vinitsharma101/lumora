"""Project CRUD API endpoints with Supabase cloud storage."""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Project, User
from app.rate_limit import check_rate_limit
from app.schemas.projects import (
    CreateProjectRequest,
    ProjectListResponse,
    ProjectResponse,
    UpdateProjectRequest,
)

router = APIRouter(tags=["projects"])


@router.post("/api/projects", response_model=ProjectResponse)
async def create_project(
    body: CreateProjectRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request)

    now = datetime.now(timezone.utc)
    project = Project(
        id=str(uuid4()),
        user_id=user.id,
        name=body.name,
        description=body.description,
        width=body.width,
        height=body.height,
        fps=body.fps,
        settings=body.settings or {
            "backgroundColor": "#000000",
            "canvasPreset": "landscape",
        },
        scenes=body.scenes or [
            {
                "id": str(uuid4()),
                "name": "Scene 1",
                "tracks": [],
                "bookmarks": [],
                "createdAt": now.isoformat(),
                "updatedAt": now.isoformat(),
            }
        ],
        duration=0.0,
        created_at=now,
        updated_at=now,
    )

    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/api/projects", response_model=list[ProjectListResponse])
async def list_projects(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request)

    stmt = (
        select(Project)
        .where(Project.user_id == user.id)
        .order_by(Project.updated_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/api/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request)

    stmt = select(Project).where(Project.id == project_id)
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check access: owner or collaborator
    if project.user_id != user.id:
        from app.models import ProjectCollaborator

        collab_stmt = select(ProjectCollaborator).where(
            ProjectCollaborator.project_id == project_id,
            ProjectCollaborator.user_id == user.id,
        )
        collab_result = await db.execute(collab_stmt)
        if not collab_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Access denied")

    return project


@router.put("/api/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    body: UpdateProjectRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request)

    stmt = select(Project).where(Project.id == project_id, Project.user_id == user.id)
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    project.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/api/projects/{project_id}")
async def delete_project(
    project_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request)

    stmt = select(Project).where(Project.id == project_id, Project.user_id == user.id)
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")

    # Clean up media files from Supabase Storage (async)
    try:
        from app.supabase_client import BUCKET_MEDIA_UPLOADS, delete_file

        from app.models import MediaAsset

        media_stmt = select(MediaAsset).where(MediaAsset.project_id == project_id)
        media_result = await db.execute(media_stmt)
        for asset in media_result.scalars().all():
            try:
                await delete_file(BUCKET_MEDIA_UPLOADS, asset.storage_path)
            except Exception:
                pass  # Best-effort cleanup
    except Exception:
        pass

    await db.delete(project)
    await db.commit()
    return {"ok": True, "deleted": project_id}


@router.post("/api/projects/{project_id}/duplicate", response_model=ProjectResponse)
async def duplicate_project(
    project_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request)

    stmt = select(Project).where(Project.id == project_id, Project.user_id == user.id)
    result = await db.execute(stmt)
    original = result.scalar_one_or_none()

    if not original:
        raise HTTPException(status_code=404, detail="Project not found")

    now = datetime.now(timezone.utc)
    duplicate = Project(
        id=str(uuid4()),
        user_id=user.id,
        name=f"{original.name} (Copy)",
        description=original.description,
        thumbnail_url=original.thumbnail_url,
        settings=original.settings,
        scenes=original.scenes,
        width=original.width,
        height=original.height,
        fps=original.fps,
        duration=original.duration,
        created_at=now,
        updated_at=now,
    )

    db.add(duplicate)
    await db.commit()
    await db.refresh(duplicate)
    return duplicate

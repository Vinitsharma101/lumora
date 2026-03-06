"""Media upload/download API endpoints using Supabase Storage."""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import MediaAsset, Project, User
from app.rate_limit import check_rate_limit
from app.schemas.projects import MediaAssetResponse
from app.supabase_client import (
    BUCKET_MEDIA_UPLOADS,
    BUCKET_THUMBNAILS,
    delete_file,
    get_public_url,
    get_storage_url,
    upload_file,
)

router = APIRouter(tags=["media"])


@router.post("/api/media/upload", response_model=MediaAssetResponse)
async def upload_media(
    request: Request,
    file: UploadFile = File(...),
    project_id: str = Form(...),
    file_type: str = Form(...),  # video, image, audio
    width: int | None = Form(None),
    height: int | None = Form(None),
    duration: float | None = Form(None),
    fps: float | None = Form(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request)

    # Verify project access
    stmt = select(Project).where(Project.id == project_id, Project.user_id == user.id)
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or access denied")

    # Read file data
    file_data = await file.read()
    file_size = len(file_data)

    # Generate storage path: {user_id}/{project_id}/{uuid}_{filename}
    asset_id = str(uuid4())
    safe_name = file.filename or f"upload.{file_type}"
    storage_path = f"{user.id}/{project_id}/{asset_id}_{safe_name}"

    # Upload to Supabase Storage (async)
    await upload_file(BUCKET_MEDIA_UPLOADS, storage_path, file_data, file.content_type or "application/octet-stream")

    # Generate signed URL for access (async)
    signed_url = await get_storage_url(BUCKET_MEDIA_UPLOADS, storage_path, expires_in=86400)

    # Create DB record
    asset = MediaAsset(
        id=asset_id,
        project_id=project_id,
        user_id=user.id,
        name=safe_name,
        file_type=file_type,
        mime_type=file.content_type,
        file_size=file_size,
        storage_path=storage_path,
        public_url=signed_url,
        width=width,
        height=height,
        duration=duration,
        fps=fps,
        created_at=datetime.now(timezone.utc),
    )

    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.get("/api/media/{project_id}", response_model=list[MediaAssetResponse])
async def list_project_media(
    project_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request)

    stmt = (
        select(MediaAsset)
        .where(MediaAsset.project_id == project_id, MediaAsset.user_id == user.id)
        .order_by(MediaAsset.created_at.desc())
    )
    result = await db.execute(stmt)
    assets = result.scalars().all()

    # Refresh signed URLs (async)
    for asset in assets:
        try:
            asset.public_url = await get_storage_url(BUCKET_MEDIA_UPLOADS, asset.storage_path, expires_in=86400)
        except Exception:
            pass

    return assets


@router.get("/api/media/{project_id}/{asset_id}/url")
async def get_media_url(
    project_id: str,
    asset_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a fresh signed URL for a media asset."""
    await check_rate_limit(request)

    stmt = select(MediaAsset).where(
        MediaAsset.id == asset_id,
        MediaAsset.project_id == project_id,
        MediaAsset.user_id == user.id,
    )
    result = await db.execute(stmt)
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    url = await get_storage_url(BUCKET_MEDIA_UPLOADS, asset.storage_path, expires_in=86400)
    return {"url": url, "asset_id": asset.id}


@router.delete("/api/media/{project_id}/{asset_id}")
async def delete_media(
    project_id: str,
    asset_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request)

    stmt = select(MediaAsset).where(
        MediaAsset.id == asset_id,
        MediaAsset.project_id == project_id,
        MediaAsset.user_id == user.id,
    )
    result = await db.execute(stmt)
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Delete from Supabase Storage (async)
    try:
        await delete_file(BUCKET_MEDIA_UPLOADS, asset.storage_path)
    except Exception:
        pass  # Best-effort

    await db.delete(asset)
    await db.commit()
    return {"ok": True, "deleted": asset_id}


@router.post("/api/media/upload-thumbnail")
async def upload_thumbnail(
    request: Request,
    file: UploadFile = File(...),
    project_id: str = Form(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a project thumbnail to the public thumbnails bucket."""
    await check_rate_limit(request)

    file_data = await file.read()
    storage_path = f"{user.id}/{project_id}/thumbnail.png"

    await upload_file(BUCKET_THUMBNAILS, storage_path, file_data, "image/png")
    public_url = await get_public_url(BUCKET_THUMBNAILS, storage_path)

    # Update project thumbnail
    stmt = select(Project).where(Project.id == project_id, Project.user_id == user.id)
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if project:
        project.thumbnail_url = public_url
        await db.commit()

    return {"url": public_url}

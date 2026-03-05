"""Pydantic schemas for project CRUD operations."""

from datetime import datetime

from pydantic import BaseModel


class CreateProjectRequest(BaseModel):
    name: str
    description: str | None = None
    width: int = 1920
    height: int = 1080
    fps: int = 30
    settings: dict | None = None
    scenes: list | None = None


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    width: int | None = None
    height: int | None = None
    fps: int | None = None
    settings: dict | None = None
    scenes: list | None = None
    thumbnail_url: str | None = None
    duration: float | None = None


class ProjectResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: str | None
    thumbnail_url: str | None
    width: int
    height: int
    fps: int
    duration: float
    settings: dict | None
    scenes: list | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: str | None
    thumbnail_url: str | None
    width: int
    height: int
    fps: int
    duration: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MediaAssetResponse(BaseModel):
    id: str
    project_id: str
    name: str
    file_type: str
    mime_type: str | None
    file_size: int
    public_url: str | None
    width: int | None
    height: int | None
    duration: float | None
    fps: float | None
    thumbnail_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}

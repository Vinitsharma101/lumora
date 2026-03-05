"""Pydantic schemas for render job operations."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class RenderRequest(BaseModel):
    project_id: str
    format: Literal["mp4", "webm"] = "mp4"
    quality: Literal["low", "medium", "high", "very_high"] = "high"
    width: int = 1920
    height: int = 1080
    fps: int = 30
    timeline_data: dict | None = None


class RenderJobResponse(BaseModel):
    id: str
    project_id: str
    status: str
    progress: float
    error_message: str | None
    format: str
    quality: str
    width: int
    height: int
    fps: int
    output_url: str | None
    output_size: int | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}

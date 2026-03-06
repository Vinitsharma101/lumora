"""Centralized storage service for uploading generated assets to Supabase.

Used by all agents to avoid duplicating upload logic. Supports uploading
from raw bytes or downloading from a URL first.
"""

import asyncio
import hashlib
import logging
import uuid

import httpx

from app.supabase_client import (
    BUCKET_AI_OUTPUTS,
    get_storage_url,
    upload_file,
)

logger = logging.getLogger(__name__)


async def upload_bytes(
    data: bytes,
    file_ext: str = "mp4",
    content_type: str = "video/mp4",
    prefix: str = "generated",
) -> str:
    """Upload raw bytes to the ai-outputs bucket, return a signed URL."""
    file_id = uuid.uuid4().hex[:12]
    path = f"{prefix}/{file_id}.{file_ext}"
    await upload_file(BUCKET_AI_OUTPUTS, path, data, content_type)
    return await get_storage_url(BUCKET_AI_OUTPUTS, path, expires_in=86400)


async def upload_from_url(
    source_url: str,
    file_ext: str | None = None,
    content_type: str | None = None,
    prefix: str = "generated",
    timeout: int = 300,
) -> str:
    """Download a file from a URL and re-upload to Supabase ai-outputs bucket.

    Returns a signed Supabase URL (24h expiry).
    """
    if not source_url:
        raise ValueError("source_url is required")

    if file_ext is None:
        file_ext = _guess_extension(source_url)
    if content_type is None:
        content_type = _guess_content_type(file_ext)

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.get(source_url)
        response.raise_for_status()
        data = response.content

    return await upload_bytes(data, file_ext, content_type, prefix)


def _guess_extension(url: str) -> str:
    """Best-effort file extension from URL."""
    lower = url.lower().split("?")[0]
    for ext in ("mp4", "webm", "mov", "png", "jpg", "jpeg", "webp", "mp3", "wav"):
        if lower.endswith(f".{ext}"):
            return ext
    return "mp4"


def _guess_content_type(ext: str) -> str:
    mapping = {
        "mp4": "video/mp4",
        "webm": "video/webm",
        "mov": "video/quicktime",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
        "mp3": "audio/mpeg",
        "wav": "audio/wav",
    }
    return mapping.get(ext, "application/octet-stream")

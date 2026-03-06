"""Supabase client singleton for storage operations.

Uses the Supabase Python SDK with the service role key for full access.
All file storage goes through Supabase Storage buckets.
All sync SDK calls are wrapped with asyncio.to_thread to avoid blocking the event loop.
"""

import asyncio

from supabase import Client, create_client

from app.config import settings

_supabase: Client | None = None

# Storage bucket names
BUCKET_MEDIA_UPLOADS = "media-uploads"
BUCKET_RENDERED_OUTPUTS = "rendered-outputs"
BUCKET_THUMBNAILS = "thumbnails"
BUCKET_AI_OUTPUTS = "ai-outputs"


def _get_supabase() -> Client:
    """Get or create the Supabase client singleton (internal, sync)."""
    global _supabase
    if _supabase is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables"
            )
        _supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _supabase


async def ensure_buckets_exist() -> None:
    """Create storage buckets if they don't exist. Call on startup."""
    def _sync_ensure():
        client = _get_supabase()
        storage = client.storage

        buckets = [
            {"id": BUCKET_MEDIA_UPLOADS, "public": False},
            {"id": BUCKET_RENDERED_OUTPUTS, "public": False},
            {"id": BUCKET_THUMBNAILS, "public": True},
            {"id": BUCKET_AI_OUTPUTS, "public": False},
        ]

        existing = {b.id for b in storage.list_buckets()}

        for bucket in buckets:
            if bucket["id"] not in existing:
                storage.create_bucket(
                    bucket["id"],
                    options={"public": bucket["public"]},
                )

    await asyncio.to_thread(_sync_ensure)


def _get_storage_url_sync(bucket: str, path: str, expires_in: int = 3600) -> str:
    client = _get_supabase()
    result = client.storage.from_(bucket).create_signed_url(path, expires_in)
    if isinstance(result, dict):
        return result.get("signedURL") or result.get("signedUrl") or result.get("signed_url", "")
    return str(result)


def _get_public_url_sync(bucket: str, path: str) -> str:
    client = _get_supabase()
    return client.storage.from_(bucket).get_public_url(path)


def _upload_file_sync(
    bucket: str, path: str, file_data: bytes, content_type: str = "application/octet-stream"
) -> str:
    client = _get_supabase()
    client.storage.from_(bucket).upload(
        path, file_data, file_options={"content-type": content_type}
    )
    return path


def _delete_file_sync(bucket: str, path: str) -> None:
    client = _get_supabase()
    client.storage.from_(bucket).remove([path])


# --- Async wrappers (use these from endpoints) ---


async def get_storage_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    """Generate a signed URL for a file in Supabase Storage."""
    return await asyncio.to_thread(_get_storage_url_sync, bucket, path, expires_in)


async def get_public_url(bucket: str, path: str) -> str:
    """Get the public URL for a file in a public bucket."""
    return await asyncio.to_thread(_get_public_url_sync, bucket, path)


async def upload_file(
    bucket: str, path: str, file_data: bytes, content_type: str = "application/octet-stream"
) -> str:
    """Upload a file to Supabase Storage and return the path."""
    return await asyncio.to_thread(_upload_file_sync, bucket, path, file_data, content_type)


async def delete_file(bucket: str, path: str) -> None:
    """Delete a file from Supabase Storage."""
    await asyncio.to_thread(_delete_file_sync, bucket, path)

"""Supabase client singleton for storage operations.

Uses the Supabase Python SDK with the service role key for full access.
All file storage goes through Supabase Storage buckets.
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


def get_supabase() -> Client:
    """Get or create the Supabase client singleton."""
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
        client = get_supabase()
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


def get_storage_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    """Generate a signed URL for a file in Supabase Storage."""
    client = get_supabase()
    result = client.storage.from_(bucket).create_signed_url(path, expires_in)
    # Supabase SDK v2 may return dict with 'signedURL' or 'signedUrl'
    if isinstance(result, dict):
        return result.get("signedURL") or result.get("signedUrl") or result.get("signed_url", "")
    return str(result)


def get_public_url(bucket: str, path: str) -> str:
    """Get the public URL for a file in a public bucket."""
    client = get_supabase()
    result = client.storage.from_(bucket).get_public_url(path)
    return result


def upload_file(bucket: str, path: str, file_data: bytes, content_type: str = "application/octet-stream") -> str:
    """Upload a file to Supabase Storage and return the path."""
    client = get_supabase()
    client.storage.from_(bucket).upload(
        path,
        file_data,
        file_options={"content-type": content_type},
    )
    return path


def delete_file(bucket: str, path: str) -> None:
    """Delete a file from Supabase Storage."""
    client = get_supabase()
    client.storage.from_(bucket).remove([path])

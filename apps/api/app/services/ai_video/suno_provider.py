"""Suno API integration for AI music generation.

Cloud API for generating full songs with lyrics, instrumentals, and sound effects.
Falls back to Replicate MusicGen if Suno is unavailable.

Config keys: SUNO_API_KEY, SUNO_API_URL
"""

import asyncio
import logging
import time

import httpx

from app.config import settings
from app.services.storage_service import upload_from_url

logger = logging.getLogger(__name__)


class SunoProvider:
    """Suno.ai cloud API for music generation."""

    def __init__(self):
        self.api_key = settings.SUNO_API_KEY
        self.base_url = settings.SUNO_API_URL or "https://studio-api.suno.ai/api"
        self.client = None
        if self.api_key:
            self.client = httpx.AsyncClient(
                base_url=self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                timeout=120.0,
            )

    def _ensure_client(self):
        if not self.client:
            raise RuntimeError("SUNO_API_KEY not configured")

    async def generate_music(
        self,
        prompt: str,
        duration: int = 30,
        instrumental: bool = True,
        style: str | None = None,
    ) -> dict:
        """Generate music from a text description.

        Returns dict with audio_url and metadata.
        """
        self._ensure_client()

        payload = {
            "prompt": prompt,
            "make_instrumental": instrumental,
            "wait_audio": False,
        }
        if style:
            payload["tags"] = style

        response = await self.client.post("/generate/v2", json=payload)
        response.raise_for_status()
        data = response.json()

        clip_ids = [clip["id"] for clip in data] if isinstance(data, list) else [data.get("id")]

        # Poll for completion
        audio_url = await self._poll_completion(clip_ids[0], timeout=300)

        if audio_url:
            stored_url = await upload_from_url(
                audio_url, "mp3", "audio/mpeg", prefix="music/suno"
            )
            return {
                "provider": "suno",
                "clip_id": clip_ids[0],
                "audio_url": stored_url,
                "original_url": audio_url,
            }

        return {"provider": "suno", "clip_id": clip_ids[0], "status": "failed"}

    async def _poll_completion(self, clip_id: str, timeout: int = 300) -> str | None:
        """Poll Suno API for clip completion."""
        self._ensure_client()
        start = time.time()

        while time.time() - start < timeout:
            response = await self.client.get(f"/feed/{clip_id}")
            response.raise_for_status()
            data = response.json()

            clips = data if isinstance(data, list) else [data]
            for clip in clips:
                if clip.get("id") == clip_id:
                    status = clip.get("status", "")
                    if status == "complete":
                        return clip.get("audio_url")
                    if status in ("error", "failed"):
                        logger.error(f"Suno clip {clip_id} failed: {clip.get('error')}")
                        return None

            await asyncio.sleep(5)

        logger.error(f"Suno clip {clip_id} timed out after {timeout}s")
        return None

    async def close(self):
        if self.client:
            await self.client.aclose()

"""OpenAI Sora video generation integration.

Uses the OpenAI API for video generation — cloud-based, no local models.
NOTE: The OpenAI video generation API endpoint is forward-looking; the actual
endpoint and payload format may change when Sora's API becomes publicly available.
"""

import httpx

from app.config import settings


class SoraProvider:
    """OpenAI Sora video generation via API."""

    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY

    def _ensure_key(self):
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY not configured for Sora")

    async def generate_video(
        self,
        prompt: str,
        duration: int = 5,
        aspect_ratio: str = "16:9",
        resolution: str = "1080p",
    ) -> dict:
        """Generate a video using OpenAI Sora."""
        self._ensure_key()

        # Map aspect ratios
        size_map = {
            "16:9": "1920x1080" if resolution == "1080p" else "1280x720",
            "9:16": "1080x1920" if resolution == "1080p" else "720x1280",
            "1:1": "1080x1080",
        }

        async with httpx.AsyncClient(timeout=300) as client:
            response = await client.post(
                "https://api.openai.com/v1/videos/generations",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "sora",
                    "prompt": prompt,
                    "size": size_map.get(aspect_ratio, "1920x1080"),
                    "duration": duration,
                    "n": 1,
                },
            )
            response.raise_for_status()
            data = response.json()

            return {
                "provider": "openai_sora",
                "generation_id": data.get("id"),
                "status": "processing",
                "raw_response": data,
            }

    async def check_generation(self, generation_id: str) -> dict:
        """Check the status of a Sora video generation."""
        self._ensure_key()

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"https://api.openai.com/v1/videos/generations/{generation_id}",
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
            response.raise_for_status()
            data = response.json()

            status = data.get("status", "processing")
            result = {
                "status": status,
                "raw_response": data,
            }

            if status == "completed":
                result["video_url"] = data.get("data", [{}])[0].get("url")

            return result

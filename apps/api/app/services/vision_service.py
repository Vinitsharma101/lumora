"""
Vision Service — Multi-modal understanding for uploaded media files.
Uses Claude Vision for images/video frames, Whisper via Replicate for audio.
"""

import asyncio
import base64
import json
import logging
from typing import Optional

import httpx
from anthropic import AsyncAnthropic

from app.config import settings

logger = logging.getLogger(__name__)


class VisionService:
    """Analyzes images, videos, and audio using AI models."""

    def __init__(self):
        self.claude = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    # ── Image Understanding ───────────────────────────────────────────────────

    async def analyze_image(self, image_url: str, task: Optional[str] = None) -> dict:
        """Analyze an image using Claude Vision. Returns structured JSON."""
        image_data = await self._fetch_as_base64(image_url)
        media_type = self._detect_media_type(image_url)

        default_task = """Analyze this image and return JSON with:
        - description: detailed scene description
        - objects: list of visible objects
        - colors: dominant color palette as hex codes
        - mood: emotional tone
        - composition: framing and composition notes
        - text_visible: any text visible in image
        - faces: number of faces and brief descriptions
        - usable_for: list of video production use cases
        Respond ONLY in JSON."""

        response = await self.claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": image_data}
                    },
                    {"type": "text", "text": task or default_task}
                ]
            }]
        )

        try:
            text = response.content[0].text
            if "```" in text:
                text = text.split("```json")[-1].split("```")[0] if "```json" in text else text.split("```")[1].split("```")[0]
            return json.loads(text.strip())
        except (json.JSONDecodeError, IndexError):
            return {"description": response.content[0].text}

    # ── Video Understanding ───────────────────────────────────────────────────

    async def analyze_video(self, video_url: str) -> dict:
        """Analyze a video by extracting key frames and analyzing them via Claude."""
        frames = await self._extract_frames_via_replicate(video_url)

        if not frames:
            return {"description": "Could not extract frames from video", "error": True}

        content = []
        for frame_b64 in frames[:6]:  # Max 6 frames to avoid token limits
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": frame_b64}
            })

        content.append({
            "type": "text",
            "text": """Analyze these video frames (in sequential order) and return JSON:
            {
              "content_type": "type of video content",
              "scene_descriptions": ["description per frame"],
              "motion_level": "static | slow | medium | fast",
              "quality": "low | medium | high | professional",
              "dominant_colors": ["#hex"],
              "subjects": ["main subjects"],
              "mood": "emotional tone",
              "suggested_uses": ["how this could be used in a video project"],
              "camera_angles_detected": ["detected camera angles"],
              "lighting_detected": "lighting description"
            }
            Respond ONLY in JSON."""
        })

        response = await self.claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[{"role": "user", "content": content}]
        )

        try:
            text = response.content[0].text
            if "```" in text:
                text = text.split("```json")[-1].split("```")[0] if "```json" in text else text.split("```")[1].split("```")[0]
            return json.loads(text.strip())
        except (json.JSONDecodeError, IndexError):
            return {"description": response.content[0].text}

    # ── Audio Understanding ───────────────────────────────────────────────────

    async def analyze_audio(self, audio_url: str) -> dict:
        """Transcribe and analyze audio using Whisper via Replicate."""
        if not settings.REPLICATE_API_TOKEN:
            return {"error": "Replicate API token not configured"}

        import replicate

        try:
            client = replicate.Client(api_token=settings.REPLICATE_API_TOKEN)
            output = await asyncio.to_thread(
                client.run,
                "openai/whisper:4d50797290df191f0bfe5c05af273e4a903dce1a243a9f01a0a579b4413c9ef7",
                input={
                    "audio": audio_url,
                    "model": "large-v3",
                    "transcription": "plain text",
                    "translate": False,
                }
            )
            return {
                "transcription": output.get("transcription", ""),
                "language": output.get("detected_language", "unknown"),
                "segments": output.get("segments", [])[:20],  # Limit segments
                "audio_type": "speech" if output.get("transcription") else "music_or_sfx",
            }
        except Exception as e:
            logger.error(f"Audio analysis failed: {e}")
            return {"error": str(e)}

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _extract_frames_via_replicate(self, video_url: str) -> list[str]:
        """Extract frames from video. Falls back to downloading the first frame."""
        # Simple approach: use the video URL directly with Claude
        # For production, use FFmpeg to extract keyframes
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Try to get a thumbnail/frame from the video URL
                r = await client.get(video_url, headers={"Range": "bytes=0-500000"})
                if r.status_code in (200, 206):
                    return [base64.b64encode(r.content).decode()]
        except Exception as e:
            logger.warning(f"Frame extraction failed: {e}")
        return []

    async def _fetch_as_base64(self, url: str) -> str:
        """Download a file and return as base64."""
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(url)
            r.raise_for_status()
            return base64.b64encode(r.content).decode()

    def _detect_media_type(self, url: str) -> str:
        url_lower = url.lower()
        if ".png" in url_lower:
            return "image/png"
        if ".webp" in url_lower:
            return "image/webp"
        if ".gif" in url_lower:
            return "image/gif"
        return "image/jpeg"

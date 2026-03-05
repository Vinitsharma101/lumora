"""Replicate API integration for AI video/image models.

Cloud API only — no local models. Supports:
- Stable Video Diffusion
- Real-ESRGAN (upscaling)
- RMBG (background removal)
- Style transfer models
- Lip sync / talking head models
"""

import asyncio

import replicate as replicate_sdk

from app.config import settings


class ReplicateProvider:
    """Replicate.com cloud API for running ML models."""

    def __init__(self):
        if settings.REPLICATE_API_TOKEN:
            self.client = replicate_sdk.Client(api_token=settings.REPLICATE_API_TOKEN)
        else:
            self.client = None

    def _ensure_client(self):
        if not self.client:
            raise RuntimeError("REPLICATE_API_TOKEN not configured")

    async def text_to_video(self, prompt: str, duration: int = 4) -> dict:
        """Generate video from text using Stable Video Diffusion on Replicate."""
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="stability-ai/stable-video-diffusion",
            input={
                "prompt": prompt,
                "num_frames": duration * 24,
            },
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    async def image_to_video(self, image_url: str, prompt: str | None = None) -> dict:
        """Animate an image using Stable Video Diffusion."""
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="stability-ai/stable-video-diffusion",
            input={
                "input_image": image_url,
                "prompt": prompt or "",
            },
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    async def upscale_image(self, image_url: str, scale: int = 2) -> dict:
        """Upscale an image using Real-ESRGAN."""
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="nightmareai/real-esrgan",
            input={
                "image": image_url,
                "scale": scale,
            },
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    async def remove_background(self, image_url: str) -> dict:
        """Remove background from an image using RMBG."""
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="cjwbw/rembg",
            input={"image": image_url},
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    async def style_transfer(self, video_url: str, style_prompt: str, strength: float = 0.7) -> dict:
        """Apply AI style transfer to a video."""
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="stability-ai/sdxl",
            input={
                "prompt": style_prompt,
                "image": video_url,
                "strength": strength,
            },
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    async def talking_head(self, face_image_url: str, audio_url: str) -> dict:
        """Generate a talking head video from a face image and audio."""
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="cjwbw/sadtalker",
            input={
                "source_image": face_image_url,
                "driven_audio": audio_url,
            },
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    async def transcribe_audio(self, audio_url: str, language: str = "en") -> dict:
        """Transcribe audio using Whisper on Replicate (no local model)."""
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="openai/whisper",
            input={
                "audio": audio_url,
                "language": language,
                "model": "large-v3",
            },
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    async def get_prediction_status(self, prediction_id: str) -> dict:
        """Check status of a Replicate prediction."""
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.get, prediction_id
        )
        return {
            "status": prediction.status,  # starting, processing, succeeded, failed, canceled
            "output": prediction.output,
            "error": prediction.error,
            "logs": prediction.logs,
        }

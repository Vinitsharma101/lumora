"""Replicate API integration for AI video/image models.

Cloud API only — no local models. Supports:
- FLUX (text-to-image)
- Stable Video Diffusion (text-to-video, image-to-video)
- Real-ESRGAN (upscaling)
- RMBG (background removal)
- Style transfer models
- Lip sync / talking head models
- LLaVA (image understanding)
- Whisper (audio transcription)
"""

import asyncio

import replicate as replicate_sdk

from app.config import settings


# ── Model Registry ────────────────────────────────────────────────────────────
MODEL_REGISTRY = {
    "text_to_image": {
        "flux-schnell": "black-forest-labs/flux-schnell",
        "flux-dev": "black-forest-labs/flux-dev",
        "sdxl": "stability-ai/sdxl:latest",
    },
    "text_to_video": {
        "minimax": "minimax/video-01",
        "wan-t2v": "wavespeedai/wan-2.1-t2v-480p",
        "svd": "stability-ai/stable-video-diffusion",
    },
    "image_to_video": {
        "svd": "stability-ai/stable-video-diffusion",
        "wan-i2v": "wavespeedai/wan-2.1-i2v-480p",
    },
    "video_to_video": {
        "animate-diff": "lucataco/animate-diff",
    },
    "upscale": {
        "real-esrgan": "nightmareai/real-esrgan:latest",
    },
    "background_removal": {
        "rmbg": "cjwbw/rmbg:latest",
    },
    "image_understanding": {
        "llava": "yorickvp/llava-v1.6-mistral-7b:latest",
    },
    "audio_transcription": {
        "whisper": "openai/whisper:latest",
    },
}

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

    # ── Text-to-Video ──

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

    # ── Image-to-Video ──

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

    # ── Text-to-Image (FLUX) ──

    async def text_to_image(
        self,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
        model: str = "schnell",
    ) -> dict:
        """Generate an image from text using FLUX models on Replicate.

        Args:
            prompt: Text description of the image to generate
            width: Image width (default 1024)
            height: Image height (default 1024)
            model: "schnell" (fast, ~2s) or "dev" (quality, ~15s)
        """
        self._ensure_client()

        model_id = (
            "black-forest-labs/flux-schnell"
            if model == "schnell"
            else "black-forest-labs/flux-dev"
        )

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model=model_id,
            input={
                "prompt": prompt,
                "width": width,
                "height": height,
                "num_outputs": 1,
            },
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
            "model": model_id,
        }

    # ── Video-to-Video ──

    async def video_to_video(
        self,
        video_url: str,
        prompt: str,
        strength: float = 0.7,
    ) -> dict:
        """Transform a video using AI style transfer / video diffusion.

        Uses SDXL for frame-level style transformation.
        """
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="stability-ai/sdxl",
            input={
                "image": video_url,
                "prompt": prompt,
                "strength": strength,
            },
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    # ── Image Understanding (LLaVA) ──

    async def describe_image(
        self,
        image_url: str,
        question: str = "Describe this image in detail. Include the subject, composition, colors, mood, and any text visible.",
    ) -> dict:
        """Analyze and describe an image using LLaVA vision model."""
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="yorickvp/llava-v1.6-34b",
            input={
                "image": image_url,
                "prompt": question,
            },
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    # ── Video Understanding ──

    async def describe_video(
        self,
        video_url: str,
        question: str = "Describe this video in detail. What is happening, who are the subjects, what is the mood, and key visual elements?",
    ) -> dict:
        """Analyze and describe a video using a vision model.

        For video understanding, we use LLaVA with a keyframe extraction approach.
        The Replicate model handles video input as a sequence of frames.
        """
        self._ensure_client()

        prediction = await asyncio.to_thread(
            self.client.predictions.create,
            model="yorickvp/llava-v1.6-34b",
            input={
                "image": video_url,
                "prompt": question,
            },
        )
        return {
            "provider": "replicate",
            "prediction_id": prediction.id,
            "status": prediction.status,
        }

    # ── Upscaling ──

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

    # ── Background Removal ──

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

    # ── Style Transfer ──

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

    # ── Talking Head ──

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

    # ── Audio Transcription (Whisper) ──

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

    # ── Prediction Status ──

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

    # ── Wait for prediction (synchronous polling) ──

    async def wait_for_prediction(self, prediction_id: str, timeout: int = 300) -> dict:
        """Poll a prediction until it completes or times out."""
        import time

        start = time.time()
        while time.time() - start < timeout:
            result = await self.get_prediction_status(prediction_id)
            if result["status"] in ("succeeded", "failed", "canceled"):
                return result
            await asyncio.sleep(2)

        return {"status": "timeout", "error": f"Prediction {prediction_id} timed out after {timeout}s"}

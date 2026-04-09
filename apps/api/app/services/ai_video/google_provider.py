"""Google Veo / Imagen API integration for video and image generation.

Uses Google Cloud Vertex AI — all cloud-based, no local models.
- Veo: Text-to-video, Image-to-video
- Imagen: Text-to-image (for storyboards and thumbnails)
"""

import base64
import logging
from typing import cast

from app.config import settings
from app.http_client import get_http_client


class GoogleAIProvider:
    """Google Cloud AI video/image generation via Vertex AI REST API."""

    def __init__(self):
        self.api_key = settings.GOOGLE_AI_API_KEY or ""
        self.project = settings.GOOGLE_CLOUD_PROJECT
        self.location = settings.GOOGLE_CLOUD_LOCATION

        if not self.api_key:
            raise RuntimeError("GOOGLE_AI_API_KEY not configured")

    @property
    def _base_url(self) -> str:
        return f"https://{self.location}-aiplatform.googleapis.com/v1"

    @property
    def _generative_url(self) -> str:
        return "https://generativelanguage.googleapis.com/v1beta"

    async def generate_video_from_text(
        self,
        prompt: str,
        duration: int = 4,
        aspect_ratio: str = "16:9",
    ) -> dict:
        """Generate video from text using Google Veo via Generative AI API."""
        client = await get_http_client()
        api_key = cast(str, self.api_key)
        response = await client.post(
            f"{self._generative_url}/models/veo-2.0-generate-001:predictLongRunning",
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            json={
                "instances": [{"prompt": prompt}],
                "parameters": {
                    "aspectRatio": aspect_ratio,
                    "durationSeconds": duration,
                    "sampleCount": 1,
                },
            },
        )
        response.raise_for_status()
        data = response.json()
        return {
            **_normalize_output("processing", output=[], operation_name=data.get("name"), raw_response=data, provider="google_veo"),
        }

    async def generate_video_from_image(
        self,
        image_url: str,
        prompt: str | None = None,
        duration: int = 4,
    ) -> dict:
        """Generate video from image using Google Veo."""
        client = await get_http_client()
        api_key = cast(str, self.api_key)

        # Download the image first
        img_response = await client.get(image_url)
        img_response.raise_for_status()
        image_b64 = base64.b64encode(img_response.content).decode()

        response = await client.post(
            f"{self._generative_url}/models/veo-2.0-generate-001:predictLongRunning",
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            json={
                "instances": [
                    {
                        "prompt": prompt or "Animate this image with natural motion",
                        "image": {"bytesBase64Encoded": image_b64},
                    }
                ],
                "parameters": {
                    "durationSeconds": duration,
                    "sampleCount": 1,
                },
            },
        )
        response.raise_for_status()
        data = response.json()
        return {
            **_normalize_output("processing", output=[], operation_name=data.get("name"), raw_response=data, provider="google_veo"),
        }

    async def check_operation(self, operation_name: str) -> dict:
        """Check the status of a long-running operation."""
        client = await get_http_client()
        api_key = cast(str, self.api_key)
        response = await client.get(
            f"{self._generative_url}/{operation_name}",
            headers={"x-goog-api-key": api_key},
        )
        response.raise_for_status()
        data = response.json()

        done = data.get("done", False)
        if done:
            result = data.get("response", {})
            videos = result.get("predictions", [])
            return {
                "status": "completed",
                "output": videos,
                "error": None,
                "videos": videos,
                "raw_response": data,
            }
        return {
            "status": "processing",
            "output": [],
            "error": None,
            "raw_response": data,
        }

    async def generate_image(
        self,
        prompt: str,
        aspect_ratio: str = "16:9",
        count: int = 1,
        negative_prompt: str | None = None,
    ) -> dict:
        """Generate image using Google Imagen for storyboards."""
        client = await get_http_client()
        api_key = cast(str, self.api_key)
        parameters: dict = {
            "sampleCount": count,
            "aspectRatio": aspect_ratio,
        }
        if negative_prompt:
            parameters["negativePrompt"] = negative_prompt
        response = await client.post(
            f"{self._generative_url}/models/imagen-3.0-generate-002:predict",
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            json={
                "instances": [{"prompt": prompt}],
                "parameters": parameters,
            },
        )
        response.raise_for_status()
        data = response.json()
        predictions = data.get("predictions", [])
        output = []
        for pred in predictions:
            if "bytesBase64Encoded" in pred:
                output.append(pred["bytesBase64Encoded"])
        return {
            "status": "completed",
            "output": output,
            "error": None,
            "provider": "google_imagen",
            "raw_response": data,
            "predictions": predictions,
        }

    async def edit_image(
        self,
        image_url: str,
        prompt: str,
    ) -> dict:
        """Edit an image using natural language via Imagen editing."""
        client = await get_http_client()
        api_key = cast(str, self.api_key)

        img_response = await client.get(image_url)
        img_response.raise_for_status()
        image_b64 = base64.b64encode(img_response.content).decode()

        response = await client.post(
            f"{self._generative_url}/models/imagen-3.0-capability-001:predict",
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            json={
                "instances": [
                    {
                        "prompt": prompt,
                        "image": {"bytesBase64Encoded": image_b64},
                    }
                ],
                "parameters": {"editMode": "EDIT_MODE_INPAINT_INSERTION"},
            },
        )
        response.raise_for_status()
        data = response.json()
        predictions = data.get("predictions", [])
        images_b64 = [
            p["bytesBase64Encoded"]
            for p in predictions
            if "bytesBase64Encoded" in p
        ]
        return {"status": "completed", "output": images_b64, "error": None, "provider": "google_imagen", "images_b64": images_b64, "count": len(images_b64)}

    async def remove_background(self, image_url: str) -> dict:
        """Remove background from an image using Imagen editing."""
        client = await get_http_client()
        api_key = cast(str, self.api_key)

        img_response = await client.get(image_url)
        img_response.raise_for_status()
        image_b64 = base64.b64encode(img_response.content).decode()

        response = await client.post(
            f"{self._generative_url}/models/imagen-3.0-capability-001:predict",
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            json={
                "instances": [
                    {
                        "prompt": "Remove the background, keep only the main subject",
                        "image": {"bytesBase64Encoded": image_b64},
                    }
                ],
                "parameters": {"editMode": "EDIT_MODE_BGSWAP"},
            },
        )
        response.raise_for_status()
        data = response.json()
        return {"status": "completed", "output": data, "error": None, "provider": "google_imagen", "raw_response": data}
logger = logging.getLogger(__name__)


def _normalize_output(status: str, output: list | dict | str | None = None, error: str | None = None, **extra) -> dict:
    return {"status": status, "output": output or [], "error": error, **extra}

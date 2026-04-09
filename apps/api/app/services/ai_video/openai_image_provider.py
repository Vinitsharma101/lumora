"""OpenAI gpt-image-1 / DALL-E image generation provider.

Cloud API only — uses the OpenAI SDK for image generation and editing.
"""

import base64
import logging

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

# Aspect ratio to pixel size mapping for OpenAI image generation
ASPECT_RATIO_SIZES = {
    "1:1": "1024x1024",
    "16:9": "1536x1024",
    "9:16": "1024x1536",
    "4:3": "1536x1024",
    "3:4": "1024x1536",
}


class OpenAIImageProvider:
    """OpenAI image generation via gpt-image-1."""

    def __init__(self):
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY not configured")
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def text_to_image(
        self,
        prompt: str,
        aspect_ratio: str = "1:1",
        quality: str = "auto",
        n: int = 1,
    ) -> dict:
        """Generate images from text using gpt-image-1.

        Returns base64-encoded images that must be uploaded to persistent storage.
        """
        size = ASPECT_RATIO_SIZES.get(aspect_ratio, "1024x1024")

        response = await self.client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            size=size,
            quality=quality,
            n=n,
            response_format="b64_json",
        )

        images_b64 = [item.b64_json for item in response.data if item.b64_json]

        return {
            "provider": "openai",
            "images_b64": images_b64,
            "count": len(images_b64),
        }

    async def text_to_image_with_reference(
        self,
        prompt: str,
        style_reference_url: str,
        aspect_ratio: str = "1:1",
        n: int = 1,
    ) -> dict:
        """Generate images using a style reference image via the edit endpoint."""
        from app.http_client import get_http_client

        http_client = await get_http_client()
        ref_resp = await http_client.get(style_reference_url)
        ref_resp.raise_for_status()
        ref_bytes = ref_resp.content

        enhanced_prompt = (
            f"Generate a new image in the same visual style as the reference image. {prompt}"
        )

        response = await self.client.images.edit(
            model="gpt-image-1",
            image=ref_bytes,
            prompt=enhanced_prompt,
            n=n,
            response_format="b64_json",
        )

        images_b64 = [item.b64_json for item in response.data if item.b64_json]
        return {
            "provider": "openai",
            "images_b64": images_b64,
            "count": len(images_b64),
        }

    async def edit_image(
        self,
        image_b64: str,
        prompt: str,
    ) -> dict:
        """Edit an image using OpenAI's image edit endpoint.

        Expects base64-encoded source image.
        """
        image_bytes = base64.b64decode(image_b64)

        response = await self.client.images.edit(
            model="gpt-image-1",
            image=image_bytes,
            prompt=prompt,
            response_format="b64_json",
        )

        images_b64 = [item.b64_json for item in response.data if item.b64_json]

        return {
            "provider": "openai",
            "images_b64": images_b64,
            "count": len(images_b64),
        }

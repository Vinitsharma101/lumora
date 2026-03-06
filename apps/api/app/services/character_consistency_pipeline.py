"""
Character Consistency Pipeline — Orchestrates reference generation,
face embedding extraction, and consistent generation across scenes.

Uses PhotoMaker/InstantID via Replicate for face-consistent image generation.
"""

import logging

from app.services.ai_video.replicate_provider import ReplicateProvider
from app.services.storage_service import upload_from_url

logger = logging.getLogger(__name__)


class CharacterConsistencyPipeline:
    """Ensures characters look consistent across all generated scenes."""

    def __init__(self):
        self.replicate = ReplicateProvider()

    async def generate_reference_sheet(self, description: str) -> dict:
        """Generate 4 reference angle images for a character using FLUX + PhotoMaker.

        Returns dict with URLs for front, side, back, three_quarter views.
        """
        angles = {
            "front": f"Portrait photo, front view, {description}, studio lighting, white background, highly detailed",
            "side": f"Portrait photo, side profile view, {description}, studio lighting, white background, highly detailed",
            "three_quarter": f"Portrait photo, three-quarter view, {description}, studio lighting, white background, highly detailed",
            "back": f"Photo from behind, back view, {description}, studio lighting, white background, highly detailed",
        }

        reference_urls = {}
        for angle_name, prompt in angles.items():
            try:
                result = await self.replicate.text_to_image(
                    prompt=prompt,
                    width=1024,
                    height=1024,
                    model="dev",
                    wait=True,
                )
                output_url = result.get("output_url")
                if output_url:
                    stored = await upload_from_url(
                        output_url, "png", "image/png",
                        prefix=f"character_refs/{angle_name}"
                    )
                    reference_urls[angle_name] = stored
            except Exception as e:
                logger.error(f"Failed generating {angle_name} reference: {e}")

        return reference_urls

    async def generate_consistent_scene(
        self,
        prompt: str,
        character_ids: list[str],
        character_references: dict,
    ) -> dict:
        """Generate a scene image with consistent character faces.

        Uses PhotoMaker with face references when available,
        falls back to InstantID for single-character scenes.
        """
        if not character_ids or not character_references:
            return await self.replicate.text_to_image(prompt=prompt, wait=True)

        # Use the first character's front reference for face consistency
        primary_char_id = character_ids[0]
        char_ref = character_references.get(primary_char_id, {})
        reference_url = (
            char_ref.get("front")
            or char_ref.get("three_quarter")
            or char_ref.get("reference_image_url")
        )

        if not reference_url:
            return await self.replicate.text_to_image(prompt=prompt, wait=True)

        # Try PhotoMaker first (better for style flexibility)
        try:
            result = await self.replicate.generate_with_face_reference(
                prompt=prompt,
                reference_image_url=reference_url,
            )
            output_url = result.get("output_url")
            if output_url:
                stored = await upload_from_url(
                    output_url, "png", "image/png", prefix="consistent_scenes"
                )
                return {**result, "stored_url": stored}
            return result
        except Exception as e:
            logger.warning(f"PhotoMaker failed, trying InstantID: {e}")

        # Fallback to InstantID
        try:
            result = await self.replicate.generate_preserving_identity(
                prompt=prompt,
                face_image_url=reference_url,
            )
            output_url = result.get("output_url")
            if output_url:
                stored = await upload_from_url(
                    output_url, "png", "image/png", prefix="consistent_scenes"
                )
                return {**result, "stored_url": stored}
            return result
        except Exception as e:
            logger.error(f"InstantID also failed: {e}")
            return await self.replicate.text_to_image(prompt=prompt, wait=True)

"""
Character Consistency Service — Maintains character identity across
AI-generated scenes using Pinecone vector embeddings and Claude Vision.

Flow:
1. User uploads a reference image or describes a character
2. Claude Vision analyzes the reference for detailed visual attributes
3. A text embedding is stored in Pinecone
4. For every scene featuring this character, the generation prompt is
   augmented with a "style suffix" ensuring visual consistency
"""

import logging
import uuid
from typing import Optional

import httpx
from anthropic import AsyncAnthropic

from app.config import settings

logger = logging.getLogger(__name__)

# Lazy Pinecone initialization
_pinecone_index = None


def _get_pinecone_index():
    """Get or create the Pinecone index singleton."""
    global _pinecone_index
    if _pinecone_index is None:
        if not settings.PINECONE_API_KEY:
            raise RuntimeError("PINECONE_API_KEY not configured")
        from pinecone import Pinecone
        pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        # Use existing index or create one
        index_name = "character-embeddings"
        existing = [idx.name for idx in pc.list_indexes()]
        if index_name not in existing:
            from pinecone import ServerlessSpec
            pc.create_index(
                name=index_name,
                dimension=1536,  # text-embedding-3-small dimension
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
        _pinecone_index = pc.Index(index_name)
    return _pinecone_index


class CharacterService:
    """Manages character profiles and ensures visual consistency."""

    def __init__(self):
        self.claude = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def register_character(
        self,
        project_id: str,
        name: str,
        description: str,
        reference_image_url: Optional[str] = None,
    ) -> dict:
        """
        Register a new character. If a reference image is provided, analyze it
        with Claude Vision and store the embedding in Pinecone.
        """
        char_id = f"char_{uuid.uuid4().hex[:8]}"
        visual_analysis = ""
        style_suffix = ""

        if reference_image_url:
            visual_analysis = await self._analyze_reference(reference_image_url)
            style_suffix = self._build_style_suffix(visual_analysis)

            # Store embedding in Pinecone
            try:
                embedding = await self._text_to_embedding(visual_analysis)
                index = _get_pinecone_index()
                index.upsert(vectors=[{
                    "id": char_id,
                    "values": embedding,
                    "metadata": {
                        "project_id": project_id,
                        "name": name,
                        "description": description,
                        "visual_analysis": visual_analysis[:1000],
                        "reference_url": reference_image_url,
                    }
                }])
            except Exception as e:
                logger.warning(f"Pinecone storage failed (non-fatal): {e}")
        else:
            # No reference image — build style suffix from description
            style_suffix = self._build_style_suffix(description)

        return {
            "char_id": char_id,
            "name": name,
            "description": description,
            "reference_image_url": reference_image_url,
            "visual_analysis": visual_analysis,
            "style_suffix": style_suffix,
            "consistency_seed": hash(char_id) % 10000,
        }

    async def get_consistent_prompt(self, base_prompt: str, char_ids: list[str]) -> str:
        """Augment a generation prompt with character consistency suffixes."""
        if not char_ids:
            return base_prompt

        suffixes = []
        try:
            index = _get_pinecone_index()
            result = index.fetch(ids=char_ids)
            for cid in char_ids:
                vec = result.get("vectors", {}).get(cid)
                if vec:
                    meta = vec.get("metadata", {})
                    analysis = meta.get("visual_analysis", "")
                    if analysis:
                        suffixes.append(self._build_style_suffix(analysis))
        except Exception as e:
            logger.warning(f"Pinecone fetch failed: {e}")

        if suffixes:
            return base_prompt + ". " + " | ".join(suffixes)
        return base_prompt

    def _build_style_suffix(self, visual_description: str) -> str:
        """Build a prompt suffix to ensure character consistency."""
        return (
            f"Character appearance (maintain exactly): {visual_description[:500]}. "
            f"Same person, same face, same clothing style, character consistency, "
            f"high fidelity character reproduction."
        )

    async def _analyze_reference(self, image_url: str) -> str:
        """Analyze a reference image using Claude Vision."""
        try:
            image_data = await self._fetch_as_base64(image_url)
            media_type = self._detect_media_type(image_url)

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
                        {
                            "type": "text",
                            "text": (
                                "Describe this character's appearance in extreme detail for consistent "
                                "reproduction in AI image generation: face shape, skin tone, hair color/style, "
                                "eye color, clothing, body type, distinctive features, accessories. "
                                "Be precise and specific. Output plain text only."
                            )
                        }
                    ]
                }]
            )
            return response.content[0].text
        except Exception as e:
            logger.error(f"Claude Vision analysis failed: {e}")
            return ""

    async def _text_to_embedding(self, text: str) -> list[float]:
        """Generate an embedding vector using OpenAI text-embedding-3-small."""
        if not settings.OPENAI_API_KEY:
            # Fallback: create a deterministic pseudo-embedding
            import hashlib
            h = hashlib.sha256(text.encode()).digest()
            return [float(b) / 255.0 for b in h] * 48  # 1536 dims

        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=text[:8000]
        )
        return response.data[0].embedding

    async def _fetch_as_base64(self, url: str) -> str:
        """Download an image and return as base64."""
        import base64
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

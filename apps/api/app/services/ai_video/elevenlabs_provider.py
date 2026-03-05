"""ElevenLabs API integration for audio generation.

Cloud API only — no local models. Supports:
- Text-to-Speech (TTS) with multiple voices
- Sound Effects (SFX) generation from text
- Voice cloning
- Voice listing
"""

import asyncio
from typing import BinaryIO

import httpx

from app.config import settings


ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"


class ElevenLabsProvider:
    """ElevenLabs cloud API for audio generation."""

    def __init__(self):
        self.api_key = settings.ELEVENLABS_API_KEY
        if not self.api_key:
            self.client = None
        else:
            self.client = httpx.AsyncClient(
                base_url=ELEVENLABS_BASE_URL,
                headers={
                    "xi-api-key": self.api_key,
                    "Content-Type": "application/json",
                },
                timeout=120.0,
            )

    def _ensure_client(self):
        if not self.client:
            raise RuntimeError("ELEVENLABS_API_KEY not configured")

    async def list_voices(self) -> dict:
        """List all available voices."""
        self._ensure_client()

        response = await self.client.get("/voices")
        response.raise_for_status()
        data = response.json()

        voices = []
        for voice in data.get("voices", []):
            voices.append({
                "voice_id": voice["voice_id"],
                "name": voice["name"],
                "category": voice.get("category", "unknown"),
                "description": voice.get("description", ""),
                "preview_url": voice.get("preview_url"),
                "labels": voice.get("labels", {}),
            })

        return {"voices": voices}

    async def text_to_speech(
        self,
        text: str,
        voice_id: str = "21m00Tcm4TlvDq8ikWAM",  # Rachel (default)
        model_id: str = "eleven_multilingual_v2",
        stability: float = 0.5,
        similarity_boost: float = 0.75,
        style: float = 0.0,
    ) -> bytes:
        """Generate speech audio from text.

        Returns raw audio bytes (MP3 format).
        """
        self._ensure_client()

        response = await self.client.post(
            f"/text-to-speech/{voice_id}",
            json={
                "text": text,
                "model_id": model_id,
                "voice_settings": {
                    "stability": stability,
                    "similarity_boost": similarity_boost,
                    "style": style,
                },
            },
            headers={
                "xi-api-key": self.api_key,
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
            },
        )
        response.raise_for_status()
        return response.content

    async def generate_sound_effect(
        self,
        prompt: str,
        duration_seconds: float | None = None,
    ) -> bytes:
        """Generate a sound effect from a text description.

        Returns raw audio bytes (MP3 format).
        """
        self._ensure_client()

        payload = {"text": prompt}
        if duration_seconds is not None:
            payload["duration_seconds"] = duration_seconds

        response = await self.client.post(
            "/sound-generation",
            json=payload,
            headers={
                "xi-api-key": self.api_key,
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
            },
        )
        response.raise_for_status()
        return response.content

    async def clone_voice(
        self,
        name: str,
        description: str,
        audio_urls: list[str],
    ) -> dict:
        """Clone a voice from audio samples.

        Downloads audio from URLs, then uploads to ElevenLabs for cloning.
        Returns the new voice ID and details.
        """
        self._ensure_client()

        # Download audio files
        download_client = httpx.AsyncClient(timeout=60.0)
        files = []
        try:
            for i, url in enumerate(audio_urls):
                resp = await download_client.get(url)
                resp.raise_for_status()
                files.append(("files", (f"sample_{i}.mp3", resp.content, "audio/mpeg")))
        finally:
            await download_client.aclose()

        # Upload to ElevenLabs
        response = await self.client.post(
            "/voices/add",
            data={"name": name, "description": description},
            files=files,
            headers={"xi-api-key": self.api_key},
        )
        response.raise_for_status()
        data = response.json()

        return {
            "voice_id": data["voice_id"],
            "name": name,
            "description": description,
        }

    async def close(self):
        """Close the HTTP client."""
        if self.client:
            await self.client.aclose()

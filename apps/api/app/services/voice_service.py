"""
Voice Service — Manages per-character voice assignment, selection, cloning,
and emotional TTS generation.

Uses ElevenLabs for high-quality TTS and voice cloning,
with Replicate XTTS-v2 as fallback.
"""

import logging
from typing import Optional

from app.services.ai_video.elevenlabs_provider import ElevenLabsProvider
from app.services.ai_video.replicate_provider import ReplicateProvider
from app.services.storage_service import upload_bytes

logger = logging.getLogger(__name__)

# Voice archetypes for automatic selection based on character description
VOICE_ARCHETYPES = {
    "male_young": "pNInz6obpgDQGcFmaJgB",       # Adam
    "male_middle": "VR6AewLTigWG4xSOukaG",       # Arnold
    "male_old": "TxGEqnHWrfWFTfGW9XjX",          # Josh
    "female_young": "21m00Tcm4TlvDq8ikWAM",      # Rachel
    "female_middle": "EXAVITQu4vr4xnSDxMaL",     # Bella
    "female_old": "MF3mGyEYCl7XYWbV9V6O",        # Elli
    "narrator_male": "pNInz6obpgDQGcFmaJgB",     # Adam
    "narrator_female": "21m00Tcm4TlvDq8ikWAM",   # Rachel
    "child": "jsCqWAovK2LkecY7zXl4",             # Freya
}


class VoiceService:
    """Manages voice assignment and generation for characters."""

    def __init__(self):
        self.elevenlabs = ElevenLabsProvider()
        self.replicate = ReplicateProvider()
        self._voice_cache: dict[str, str] = {}

    async def select_voice_for_character(self, character: dict) -> str:
        """Select an appropriate voice ID based on character description.

        Analyzes the description keywords to pick a matching voice archetype.
        """
        char_id = character.get("char_id", "")
        if char_id in self._voice_cache:
            return self._voice_cache[char_id]

        desc = (character.get("description", "") + " " + character.get("name", "")).lower()
        voice_assignment = character.get("voice_assignment")
        if voice_assignment:
            self._voice_cache[char_id] = voice_assignment
            return voice_assignment

        # Simple keyword matching for archetype
        archetype = "narrator_male"
        if any(w in desc for w in ("woman", "female", "girl", "she", "her", "mother", "sister", "queen", "princess")):
            if any(w in desc for w in ("young", "girl", "teen", "20s")):
                archetype = "female_young"
            elif any(w in desc for w in ("old", "elderly", "grandmother", "60s", "70s")):
                archetype = "female_old"
            else:
                archetype = "female_middle"
        elif any(w in desc for w in ("child", "kid", "boy", "young girl")):
            archetype = "child"
        elif any(w in desc for w in ("narrator",)):
            archetype = "narrator_male" if "male" in desc or "man" in desc else "narrator_female"
        else:
            if any(w in desc for w in ("young", "teen", "20s")):
                archetype = "male_young"
            elif any(w in desc for w in ("old", "elderly", "grandfather", "60s", "70s")):
                archetype = "male_old"
            else:
                archetype = "male_middle"

        voice_id = VOICE_ARCHETYPES.get(archetype, VOICE_ARCHETYPES["narrator_male"])
        self._voice_cache[char_id] = voice_id
        return voice_id

    async def generate_dialog(
        self,
        text: str,
        character: dict,
        emotion: str = "neutral",
    ) -> Optional[str]:
        """Generate speech for a character's dialog line.

        Returns a Supabase URL to the generated audio, or None on failure.
        """
        voice_id = await self.select_voice_for_character(character)

        # Map emotion to ElevenLabs voice settings
        stability, similarity, style = _emotion_to_settings(emotion)

        try:
            audio_bytes = await self.elevenlabs.text_to_speech(
                text=text,
                voice_id=voice_id,
                stability=stability,
                similarity_boost=similarity,
                style=style,
            )
            if audio_bytes:
                return await upload_bytes(
                    audio_bytes, "mp3", "audio/mpeg",
                    prefix=f"dialog/{character.get('char_id', 'unknown')}"
                )
        except Exception as e:
            logger.warning(f"ElevenLabs TTS failed for {character.get('name')}: {e}")

        # Fallback: generate a reference sample via ElevenLabs default voice, then use XTTS-v2
        try:
            default_voice_id = VOICE_ARCHETYPES["narrator_male"]
            ref_bytes = await self.elevenlabs.text_to_speech(
                text="Hello, this is a reference sample for voice cloning.",
                voice_id=default_voice_id,
            )
            if ref_bytes:
                ref_url = await upload_bytes(
                    ref_bytes, "mp3", "audio/mpeg", prefix="voice_ref"
                )
                result = await self.replicate.clone_voice_and_speak(
                    text=text,
                    speaker_wav_url=ref_url,
                    language="en",
                )
                output_url = result.get("output_url")
                if output_url:
                    from app.services.storage_service import upload_from_url
                    return await upload_from_url(output_url, "mp3", "audio/mpeg", prefix="dialog")
        except Exception as e:
            logger.error(f"XTTS-v2 fallback also failed: {e}")

        return None

    async def clone_voice(
        self,
        name: str,
        description: str,
        audio_sample_urls: list[str],
    ) -> Optional[str]:
        """Clone a voice from audio samples. Returns the new voice ID."""
        try:
            result = await self.elevenlabs.clone_voice(
                name=name,
                description=description,
                audio_urls=audio_sample_urls,
            )
            return result.get("voice_id")
        except Exception as e:
            logger.error(f"Voice cloning failed for {name}: {e}")
            return None

    async def close(self):
        await self.elevenlabs.close()


def _emotion_to_settings(emotion: str) -> tuple[float, float, float]:
    """Map emotion to ElevenLabs (stability, similarity_boost, style) settings."""
    presets = {
        "neutral":    (0.5, 0.75, 0.0),
        "happy":      (0.4, 0.8, 0.3),
        "sad":        (0.6, 0.7, 0.2),
        "angry":      (0.3, 0.8, 0.5),
        "excited":    (0.3, 0.85, 0.4),
        "whisper":    (0.7, 0.6, 0.1),
        "dramatic":   (0.4, 0.8, 0.4),
        "calm":       (0.7, 0.7, 0.1),
        "scared":     (0.3, 0.75, 0.3),
    }
    return presets.get(emotion, presets["neutral"])

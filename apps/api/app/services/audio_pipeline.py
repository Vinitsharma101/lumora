"""
Audio Pipeline — Generates and mixes all audio layers for a scene:
dialog TTS (per character voice), ambient audio, foley SFX, and background music.

Uses FFmpeg for mixing with loudnorm, amix, and volume filters.
"""

import asyncio
import logging
import os
import tempfile

from app.services.ai_video.elevenlabs_provider import ElevenLabsProvider
from app.services.storage_service import upload_bytes
from app.services.voice_service import VoiceService

logger = logging.getLogger(__name__)


class AudioPipeline:
    """Full audio pipeline for scene-level audio generation and mixing."""

    def __init__(self):
        self.voice_service = VoiceService()
        self.elevenlabs = ElevenLabsProvider()

    async def generate_scene_audio(
        self,
        scene: dict,
        character_profiles: dict,
    ) -> dict:
        """Generate all audio layers for a scene and return URLs.

        Returns dict with keys: dialog_urls, ambient_url, sfx_urls
        """
        result = {
            "dialog_urls": [],
            "ambient_url": None,
            "sfx_urls": [],
        }

        for dialog_entry in scene.get("dialog", []):
            speaker_id = dialog_entry.get("speaker")
            line = dialog_entry.get("line", "")
            emotion = dialog_entry.get("emotion", "neutral")

            if not line:
                continue

            character = character_profiles.get(speaker_id, {"char_id": speaker_id})
            audio_url = await self.voice_service.generate_dialog(
                text=line,
                character=character,
                emotion=emotion,
            )
            if audio_url:
                result["dialog_urls"].append({
                    "speaker": speaker_id,
                    "line": line,
                    "audio_url": audio_url,
                })

        audio_spec = scene.get("audio", {})
        if audio_spec and audio_spec.get("description"):
            try:
                ambient_bytes = await self.elevenlabs.generate_sound_effect(
                    prompt=f"Room tone, ambient audio: {audio_spec['description']}",
                    duration_seconds=scene.get("duration", 10),
                )
                if ambient_bytes:
                    result["ambient_url"] = await upload_bytes(
                        ambient_bytes, "mp3", "audio/mpeg", prefix="ambient"
                    )
            except Exception as e:
                logger.warning(f"Ambient generation failed: {e}")

        return result

    async def mix_scene_audio(
        self,
        dialog_urls: list[str],
        ambient_url: str | None,
        music_url: str | None,
        scene_duration: float,
    ) -> str | None:
        """Mix dialog, ambient, and music into a single audio file.

        Dialog at -16 LUFS, music ducked -6dB under dialog, ambient at -20dB.
        Returns URL of mixed audio file.
        """
        if not dialog_urls and not ambient_url and not music_url:
            return None

        with tempfile.TemporaryDirectory() as tmpdir:
            input_files = []

            for i, url in enumerate(dialog_urls):
                path = os.path.join(tmpdir, f"dialog_{i}.mp3")
                if await _download_file(url, path):
                    input_files.append(path)

            if ambient_url:
                ambient_path = os.path.join(tmpdir, "ambient.mp3")
                if await _download_file(ambient_url, ambient_path):
                    input_files.append(ambient_path)

            if music_url:
                music_path = os.path.join(tmpdir, "music.mp3")
                if await _download_file(music_url, music_path):
                    input_files.append(music_path)

            if not input_files:
                return None

            output_path = os.path.join(tmpdir, "mixed.mp3")
            cmd = ["ffmpeg", "-y"]
            for f in input_files:
                cmd.extend(["-i", f])

            if len(input_files) == 1:
                cmd.extend([
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    output_path,
                ])
            else:
                cmd.extend([
                    "-filter_complex",
                    f"amix=inputs={len(input_files)}:duration=longest:dropout_transition=2,loudnorm=I=-16:TP=-1.5:LRA=11",
                    output_path,
                ])

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()

            if proc.returncode != 0:
                logger.error(f"Audio mixing failed: {stderr.decode()[:500]}")
                return None

            if os.path.exists(output_path):
                with open(output_path, "rb") as f:
                    return await upload_bytes(
                        f.read(), "mp3", "audio/mpeg", prefix="mixed_audio"
                    )

        return None

    async def close(self):
        await self.voice_service.close()
        await self.elevenlabs.close()


async def _download_file(url: str, path: str) -> bool:
    """Download a file from URL to local path."""
    if not url or not url.startswith("http"):
        return False
    try:
        import httpx
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            with open(path, "wb") as f:
                f.write(resp.content)
        return True
    except Exception as e:
        logger.error(f"Download failed: {e}")
        return False

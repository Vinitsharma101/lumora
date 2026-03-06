"""
Analysis Agent — Analyzes video chunks using real AI services.
Extracts keyframes via FFmpeg, sends to Claude Vision for visual analysis,
transcribes audio via Replicate Whisper, returns structured Video Map.
"""

import asyncio
import base64
import json
import logging
import os
import tempfile

import httpx
from anthropic import AsyncAnthropic

from app.config import settings
from app.services.ai_video.replicate_provider import ReplicateProvider

logger = logging.getLogger(__name__)

ANALYSIS_SYSTEM_PROMPT = """You are an advanced Video and Audio Analysis AI.
Analyze the provided keyframes from a video chunk and extract detailed metadata.

Return ONLY valid JSON in the following format:
{
  "vision": {
    "scene_type": "indoor/outdoor/studio/mixed",
    "scenes": [
      {"timestamp": 0, "description": "Brief scene description", "shot_type": "wide/medium/close-up"}
    ],
    "objects_detected": ["desk", "computer", "person"],
    "faces": [{"id": 1, "description": "person description", "timestamps": [0, 10, 20]}],
    "dominant_colors": ["#1a1a2e", "#e94560"],
    "mood": "dramatic/cheerful/mysterious/calm",
    "motion_level": "low/medium/high"
  },
  "audio": {
    "transcription": [],
    "noise_profile": "clean/noisy/mixed",
    "avg_lufs": -14
  }
}
"""


async def _extract_keyframes(video_path: str, tmpdir: str, count: int = 6) -> list[str]:
    """Extract evenly-spaced keyframes from a video as JPEG files."""
    output_pattern = os.path.join(tmpdir, "frame_%03d.jpg")

    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    try:
        duration = float(stdout.decode().strip())
    except ValueError:
        duration = 120.0

    interval = max(1, int(duration / count))

    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", f"fps=1/{interval},scale=512:-1",
        "-frames:v", str(count),
        "-q:v", "3",
        output_pattern,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await proc.communicate()

    frames = []
    for i in range(1, count + 1):
        path = os.path.join(tmpdir, f"frame_{i:03d}.jpg")
        if os.path.exists(path):
            frames.append(path)
    return frames


def _encode_image_base64(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


class AnalysisAgent:
    """Analyzes a single video chunk for vision and audio features using real AI services."""

    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.replicate = ReplicateProvider()

    async def run(self, state: dict) -> dict:
        """Run analysis on the current chunk."""
        current_chunk = state.get("current_chunk")
        if not current_chunk:
            return {**state, "error": "No current_chunk found for analysis", "status": "failed"}

        chunk_id = current_chunk.get("chunk_id")
        chunk_url = current_chunk.get("url")
        chunk_audio_url = current_chunk.get("audio_url")

        logger.info(f"AnalysisAgent: Analyzing chunk {chunk_id}")

        vision_task = self._analyze_vision(chunk_url, chunk_id)
        audio_task = self._analyze_audio(chunk_audio_url, chunk_id)
        vision_result, audio_result = await asyncio.gather(
            vision_task, audio_task, return_exceptions=True
        )

        video_map = {"vision": {}, "audio": {}}

        if isinstance(vision_result, Exception):
            logger.error(f"Vision analysis failed for {chunk_id}: {vision_result}")
            video_map["vision"] = {"error": str(vision_result)}
        else:
            video_map["vision"] = vision_result

        if isinstance(audio_result, Exception):
            logger.error(f"Audio analysis failed for {chunk_id}: {audio_result}")
            video_map["audio"] = {"error": str(audio_result)}
        else:
            video_map["audio"] = audio_result

        all_maps = state.get("video_maps", {})
        if not isinstance(all_maps, dict):
            all_maps = {}
        all_maps[chunk_id] = video_map

        return {
            **state,
            "video_maps": all_maps,
            "status": "analysis_complete",
            "messages": state.get("messages", []) + [
                {"role": "agent", "content": f"Analysis complete for chunk {chunk_id}."}
            ]
        }

    async def _analyze_vision(self, chunk_url: str | None, chunk_id: str) -> dict:
        """Extract keyframes and analyze with Claude Vision."""
        if not chunk_url:
            return {"error": "No chunk URL for vision analysis"}

        with tempfile.TemporaryDirectory() as tmpdir:
            video_path = os.path.join(tmpdir, "chunk.mp4")
            async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
                resp = await client.get(chunk_url)
                resp.raise_for_status()
                with open(video_path, "wb") as f:
                    f.write(resp.content)

            frame_paths = await _extract_keyframes(video_path, tmpdir, count=6)
            if not frame_paths:
                return {"error": "No keyframes extracted"}

            content_parts = [
                {"type": "text", "text": f"Analyze these {len(frame_paths)} keyframes from video chunk {chunk_id}. Describe what you see in detail."}
            ]
            for frame_path in frame_paths:
                b64 = _encode_image_base64(frame_path)
                content_parts.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": b64,
                    }
                })

            response = await self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                system=ANALYSIS_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": content_parts}],
            )

            text = response.content[0].text
            if "```" in text:
                text = text.split("```json")[-1].split("```")[0] if "```json" in text else text.split("```")[1].split("```")[0]

            parsed = json.loads(text.strip())
            return parsed.get("vision", parsed)

    async def _analyze_audio(self, audio_url: str | None, chunk_id: str) -> dict:
        """Transcribe audio via Replicate Whisper."""
        if not audio_url:
            return {"transcription": [], "noise_profile": "unknown", "avg_lufs": -14}

        try:
            result = await self.replicate.run_and_wait(
                "openai/whisper",
                {"audio": audio_url, "language": "en", "model": "large-v3"},
                timeout=300,
            )

            output = result.get("output", {})
            if isinstance(output, dict):
                segments = output.get("segments", [])
                transcription = [
                    {"start": s.get("start", 0), "end": s.get("end", 0), "text": s.get("text", "")}
                    for s in segments
                ]
            else:
                transcription = []

            return {
                "transcription": transcription,
                "noise_profile": "clean",
                "avg_lufs": -14,
            }
        except Exception as e:
            logger.error(f"Whisper transcription failed for chunk {chunk_id}: {e}")
            return {"transcription": [], "noise_profile": "unknown", "avg_lufs": -14, "error": str(e)}

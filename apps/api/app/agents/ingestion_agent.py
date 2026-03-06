"""
Ingestion Agent — Handles raw video preprocessing and chunking.
Downloads source from Supabase, splits with FFmpeg into overlapping segments,
uploads chunks back to Supabase for parallel processing.
"""

import asyncio
import logging
import os
import tempfile
import uuid

import httpx

from app.services.storage_service import upload_bytes
from app.supabase_client import BUCKET_MEDIA_UPLOADS, get_storage_url

logger = logging.getLogger(__name__)


async def _get_video_duration(video_path: str) -> float:
    """Get video duration in seconds using FFprobe."""
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
        return float(stdout.decode().strip())
    except ValueError:
        return 3600.0


async def _split_chunk(
    input_path: str,
    start_time: float,
    duration: float,
    output_path: str,
) -> bool:
    """Extract a chunk from the source video using FFmpeg."""
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y",
        "-ss", str(start_time),
        "-i", input_path,
        "-t", str(duration),
        "-c", "copy",
        "-avoid_negative_ts", "make_zero",
        output_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        logger.error(f"FFmpeg chunk extraction failed: {stderr.decode()[:500]}")
        return False
    return True


async def _extract_audio(input_path: str, output_path: str) -> bool:
    """Extract master audio track from video."""
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y",
        "-i", input_path,
        "-vn", "-acodec", "libmp3lame", "-q:a", "2",
        output_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        logger.error(f"FFmpeg audio extraction failed: {stderr.decode()[:500]}")
        return False
    return True


class IngestionAgent:
    """Preprocesses and chunks raw video uploads using FFmpeg."""

    async def run(self, state: dict) -> dict:
        """Download source video, extract audio, split into overlapping chunks, upload all back."""
        raw_video_url = state.get("raw_video_url")
        project_id = state.get("project_id", "unknown")

        if not raw_video_url:
            return {**state, "error": "No raw_video_url provided", "status": "failed"}

        logger.info(f"IngestionAgent: Processing raw video for project {project_id}")

        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = os.path.join(tmpdir, "source.mp4")

            # Download source video (from Supabase signed URL or direct URL)
            source_url = raw_video_url
            if not raw_video_url.startswith("http"):
                source_url = await get_storage_url(BUCKET_MEDIA_UPLOADS, raw_video_url)

            async with httpx.AsyncClient(timeout=600, follow_redirects=True) as client:
                resp = await client.get(source_url)
                resp.raise_for_status()
                with open(input_path, "wb") as f:
                    f.write(resp.content)

            # Get actual duration
            total_duration = await _get_video_duration(input_path)
            logger.info(f"IngestionAgent: Source video is {total_duration:.1f}s")

            # Extract master audio
            master_audio_path = os.path.join(tmpdir, "master_audio.mp3")
            audio_extracted = await _extract_audio(input_path, master_audio_path)
            master_audio_url = None
            if audio_extracted and os.path.exists(master_audio_path):
                with open(master_audio_path, "rb") as f:
                    master_audio_url = await upload_bytes(
                        f.read(), "mp3", "audio/mpeg",
                        prefix=f"ingestion/{project_id}"
                    )

            # Split into overlapping chunks
            chunk_core_duration = 120  # 2 minutes
            overlap = 2  # 2 seconds overlap
            chunks = []
            current_time = 0.0
            chunk_idx = 0

            while current_time < total_duration:
                end_time = min(total_duration, current_time + chunk_core_duration + overlap)
                chunk_duration = end_time - current_time

                chunk_video_path = os.path.join(tmpdir, f"chunk_{chunk_idx}.mp4")
                chunk_audio_path = os.path.join(tmpdir, f"chunk_{chunk_idx}_audio.mp3")

                success = await _split_chunk(input_path, current_time, chunk_duration, chunk_video_path)

                chunk_video_url = None
                chunk_audio_url = None

                if success and os.path.exists(chunk_video_path):
                    with open(chunk_video_path, "rb") as f:
                        chunk_video_url = await upload_bytes(
                            f.read(), "mp4", "video/mp4",
                            prefix=f"ingestion/{project_id}/chunks"
                        )

                    # Extract chunk audio
                    audio_ok = await _extract_audio(chunk_video_path, chunk_audio_path)
                    if audio_ok and os.path.exists(chunk_audio_path):
                        with open(chunk_audio_path, "rb") as f:
                            chunk_audio_url = await upload_bytes(
                                f.read(), "mp3", "audio/mpeg",
                                prefix=f"ingestion/{project_id}/chunks"
                            )

                chunks.append({
                    "chunk_id": f"chunk_{uuid.uuid4().hex[:8]}",
                    "index": chunk_idx,
                    "start_time": current_time,
                    "end_time": end_time,
                    "duration": chunk_duration,
                    "overlap_seconds": overlap if end_time < total_duration else 0,
                    "url": chunk_video_url,
                    "audio_url": chunk_audio_url,
                })

                current_time += chunk_core_duration
                chunk_idx += 1

        return {
            **state,
            "raw_video_url": raw_video_url,
            "master_audio_url": master_audio_url,
            "chunk_metadata": chunks,
            "total_duration": total_duration,
            "status": "ingestion_complete",
            "messages": state.get("messages", []) + [
                {"role": "agent", "content": f"Ingestion complete: {total_duration:.0f}s video split into {len(chunks)} overlapping chunks."}
            ]
        }

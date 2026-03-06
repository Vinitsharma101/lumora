"""FFmpeg pipeline for server-side video rendering.

Translates timeline JSON into FFmpeg commands.
Uses FFmpeg CLI — no GPU required (runs on any server).
For GPU-accelerated encoding, set NVENC flags when available.
"""

import asyncio
import os
import tempfile

from app.supabase_client import (
    BUCKET_MEDIA_UPLOADS,
    BUCKET_RENDERED_OUTPUTS,
    _get_storage_url_sync,
    _upload_file_sync,
)


async def render_timeline(
    job_id: str,
    timeline_data: dict,
    format: str = "mp4",
    quality: str = "high",
    width: int = 1920,
    height: int = 1080,
    fps: int = 30,
    user_id: str = "",
    progress_callback=None,
) -> dict:
    """Render a timeline to a video file using FFmpeg.

    1. Download all media assets from Supabase
    2. Build FFmpeg filter graph from timeline
    3. Encode output
    4. Upload result to Supabase
    5. Return output URL
    """
    quality_settings = {
        "low": {"crf": "28", "preset": "fast"},
        "medium": {"crf": "23", "preset": "medium"},
        "high": {"crf": "18", "preset": "slow"},
        "very_high": {"crf": "15", "preset": "veryslow"},
    }

    crf = quality_settings.get(quality, quality_settings["high"])["crf"]
    preset = quality_settings.get(quality, quality_settings["high"])["preset"]

    with tempfile.TemporaryDirectory() as tmpdir:
        # Download media assets
        tracks = timeline_data.get("tracks", [])
        downloaded_files = {}

        for track in tracks:
            for clip in track.get("clips", track.get("elements", [])):
                asset_url = clip.get("asset_url") or clip.get("mediaAssetId")
                if asset_url and asset_url not in downloaded_files:
                    try:
                        local_path = os.path.join(tmpdir, f"input_{len(downloaded_files)}.mp4")
                        await _download_file(asset_url, local_path)
                        downloaded_files[asset_url] = local_path
                    except Exception:
                        pass

        if not downloaded_files:
            raise RuntimeError("No media files to render")

        # Build FFmpeg command
        output_ext = "mp4" if format == "mp4" else "webm"
        output_path = os.path.join(tmpdir, f"output.{output_ext}")

        cmd = _build_ffmpeg_command(
            tracks=tracks,
            downloaded_files=downloaded_files,
            output_path=output_path,
            width=width,
            height=height,
            fps=fps,
            crf=crf,
            preset=preset,
            format=format,
        )

        if progress_callback:
            await progress_callback(0.3, "rendering")

        # Execute FFmpeg asynchronously
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=600)

        if process.returncode != 0:
            raise RuntimeError(f"FFmpeg failed: {stderr.decode()[:500]}")

        if progress_callback:
            await progress_callback(0.8, "uploading")

        # Upload to Supabase (run sync I/O in thread)
        with open(output_path, "rb") as f:
            output_data = f.read()

        storage_path = f"{user_id}/{job_id}/output.{output_ext}"
        content_type = "video/mp4" if format == "mp4" else "video/webm"
        await asyncio.to_thread(
            _upload_file_sync, BUCKET_RENDERED_OUTPUTS, storage_path, output_data, content_type,
        )
        output_url = await asyncio.to_thread(
            _get_storage_url_sync, BUCKET_RENDERED_OUTPUTS, storage_path, 86400 * 7,
        )

        return {
            "output_url": output_url,
            "output_size": len(output_data),
            "storage_path": storage_path,
        }


def _build_ffmpeg_command(
    tracks: list,
    downloaded_files: dict,
    output_path: str,
    width: int,
    height: int,
    fps: int,
    crf: str,
    preset: str,
    format: str,
) -> list[str]:
    """Build an FFmpeg command from timeline tracks."""
    cmd = ["ffmpeg", "-y"]

    # Add input files
    input_index = 0
    file_indices = {}
    for url, path in downloaded_files.items():
        cmd.extend(["-i", path])
        file_indices[url] = input_index
        input_index += 1

    # Simple concat approach — for complex timelines, use filter_complex
    if len(downloaded_files) == 1:
        # Single input — direct encode
        if format == "mp4":
            cmd.extend([
                "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2",
                "-c:v", "libx264",
                "-crf", crf,
                "-preset", preset,
                "-c:a", "aac",
                "-b:a", "192k",
                "-r", str(fps),
                "-movflags", "+faststart",
            ])
        else:
            cmd.extend([
                "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2",
                "-c:v", "libvpx-vp9",
                "-crf", crf,
                "-c:a", "libopus",
                "-b:a", "192k",
                "-r", str(fps),
            ])
    else:
        # Multiple inputs — concat filter
        filter_parts = []
        for i in range(len(downloaded_files)):
            filter_parts.append(
                f"[{i}:v]scale={width}:{height}:force_original_aspect_ratio=decrease,"
                f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v{i}]"
            )

        concat_inputs = "".join(f"[v{i}]" for i in range(len(downloaded_files)))
        filter_parts.append(f"{concat_inputs}concat=n={len(downloaded_files)}:v=1:a=0[outv]")
        filter_complex = ";".join(filter_parts)

        cmd.extend(["-filter_complex", filter_complex, "-map", "[outv]"])

        if format == "mp4":
            cmd.extend(["-c:v", "libx264", "-crf", crf, "-preset", preset, "-r", str(fps), "-movflags", "+faststart"])
        else:
            cmd.extend(["-c:v", "libvpx-vp9", "-crf", crf, "-r", str(fps)])

    cmd.append(output_path)
    return cmd


async def _download_file(url: str, local_path: str) -> None:
    """Download a file from URL to local path."""
    from app.http_client import get_http_client

    client = await get_http_client()
    response = await client.get(url)
    response.raise_for_status()
    with open(local_path, "wb") as f:
        f.write(response.content)

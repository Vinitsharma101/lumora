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

        # Scale and prepare audio for each input
        for i in range(len(downloaded_files)):
            filter_parts.append(f"[{i}:a]aresample=async=1000,apad[a{i}]")

        concat_inputs = "".join(f"[v{i}][a{i}]" for i in range(len(downloaded_files)))
        filter_parts.append(f"{concat_inputs}concat=n={len(downloaded_files)}:v=1:a=1[outv][outa]")
        filter_complex = ";".join(filter_parts)

        cmd.extend(["-filter_complex", filter_complex, "-map", "[outv]", "-map", "[outa]"])

        if format == "mp4":
            cmd.extend(["-c:v", "libx264", "-crf", crf, "-preset", preset, "-c:a", "aac", "-b:a", "192k", "-r", str(fps), "-movflags", "+faststart"])
        else:
            cmd.extend(["-c:v", "libvpx-vp9", "-crf", crf, "-c:a", "libopus", "-b:a", "192k", "-r", str(fps)])

    cmd.append(output_path)
    return cmd


async def render_movie(
    job_id: str,
    timeline_data: dict,
    title: str = "",
    credits_text: str = "",
    subtitle_url: str | None = None,
    width: int = 1920,
    height: int = 1080,
    fps: int = 24,
    user_id: str = "",
    progress_callback=None,
) -> dict:
    """Render a full movie with multi-track audio, subtitles, title card, and credits."""
    quality_settings = {"crf": "18", "preset": "slow"}

    with tempfile.TemporaryDirectory() as tmpdir:
        tracks = timeline_data.get("tracks", {})
        downloaded_files = {}
        video_clips = []

        for clip in tracks.get("video", []):
            asset_url = clip.get("assetUrl") or clip.get("asset_url")
            if asset_url and asset_url not in downloaded_files:
                local_path = os.path.join(tmpdir, f"v_{len(downloaded_files)}.mp4")
                try:
                    await _download_file(asset_url, local_path)
                    downloaded_files[asset_url] = local_path
                except Exception:
                    continue
            if asset_url and asset_url in downloaded_files:
                video_clips.append({
                    "path": downloaded_files[asset_url],
                    "start": clip.get("startTime", 0),
                    "duration": clip.get("duration", 5),
                    "color_grading": clip.get("color_grading"),
                })

        audio_files = []
        for track_type in ("audio", "music", "effects"):
            for clip in tracks.get(track_type, []):
                asset_url = clip.get("assetUrl") or clip.get("asset_url") or clip.get("audio_url")
                if asset_url and asset_url not in downloaded_files:
                    local_path = os.path.join(tmpdir, f"a_{len(downloaded_files)}.mp3")
                    try:
                        await _download_file(asset_url, local_path)
                        downloaded_files[asset_url] = local_path
                        audio_files.append({"path": local_path, "type": track_type, "start": clip.get("startTime", 0)})
                    except Exception:
                        continue

        if not video_clips:
            raise RuntimeError("No video clips to render for movie")

        if progress_callback:
            await progress_callback(0.2, "building_movie")

        title_path = None
        if title:
            title_path = os.path.join(tmpdir, "title.mp4")
            escaped_title = _escape_ffmpeg_text(title)
            title_cmd = [
                "ffmpeg", "-y",
                "-f", "lavfi", "-i", f"color=c=black:s={width}x{height}:d=4:r={fps}",
                "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
                "-t", "4",
                "-vf", f"drawtext=text='{escaped_title}':fontcolor=white:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
                title_path,
            ]
            proc = await asyncio.create_subprocess_exec(
                *title_cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()

        credits_path = None
        if credits_text:
            credits_path = os.path.join(tmpdir, "credits.mp4")
            escaped_credits = _escape_ffmpeg_text(credits_text)
            credits_cmd = [
                "ffmpeg", "-y",
                "-f", "lavfi", "-i", f"color=c=black:s={width}x{height}:d=6:r={fps}",
                "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
                "-t", "6",
                "-vf", f"drawtext=text='{escaped_credits}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=h-mod(t*50\\,h+text_h)",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
                credits_path,
            ]
            proc = await asyncio.create_subprocess_exec(
                *credits_cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()

        concat_list_path = os.path.join(tmpdir, "concat.txt")
        concat_entries = []
        if title_path and os.path.exists(title_path):
            concat_entries.append(f"file '{title_path}'")
        for vc in video_clips:
            concat_entries.append(f"file '{vc['path']}'")
        if credits_path and os.path.exists(credits_path):
            concat_entries.append(f"file '{credits_path}'")

        with open(concat_list_path, "w") as f:
            f.write("\n".join(concat_entries))

        if progress_callback:
            await progress_callback(0.4, "encoding")

        output_path = os.path.join(tmpdir, "movie.mp4")
        cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_list_path]

        for af in audio_files:
            cmd.extend(["-i", af["path"]])

        if audio_files:
            audio_filter = f"amix=inputs={len(audio_files)}:duration=longest:dropout_transition=2,loudnorm=I=-16:TP=-1.5:LRA=11"
            audio_map_inputs = "".join(f"[{i + 1}:a]" for i in range(len(audio_files)))
            cmd.extend([
                "-filter_complex", f"{audio_map_inputs}{audio_filter}[amixed]",
                "-map", "0:v", "-map", "[amixed]",
            ])
        else:
            cmd.extend(["-map", "0:v"])

        vf_filters = [f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2"]
        if subtitle_url:
            srt_path = os.path.join(tmpdir, "subs.srt")
            try:
                await _download_file(subtitle_url, srt_path)
                vf_filters.append(f"subtitles={srt_path}")
            except Exception:
                pass

        cmd.extend([
            "-vf", ",".join(vf_filters),
            "-c:v", "libx264", "-crf", quality_settings["crf"], "-preset", quality_settings["preset"],
            "-c:a", "aac", "-b:a", "192k", "-r", str(fps), "-movflags", "+faststart",
        ])

        chapter_metadata = timeline_data.get("chapter_metadata", [])
        if chapter_metadata:
            metadata_path = os.path.join(tmpdir, "chapters.txt")
            with open(metadata_path, "w") as mf:
                mf.write(";FFMETADATA1\n")
                for chapter in chapter_metadata:
                    start_ms = int(chapter.get("start", 0) * 1000)
                    end_ms = int(chapter.get("end", 0) * 1000)
                    ch_title = chapter.get("title", "")
                    mf.write(f"[CHAPTER]\nTIMEBASE=1/1000\nSTART={start_ms}\nEND={end_ms}\ntitle={ch_title}\n")
            cmd.extend(["-i", metadata_path, "-map_metadata", str(1 + len(audio_files))])

        cmd.append(output_path)

        if progress_callback:
            await progress_callback(0.5, "rendering_movie")

        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=1800)

        if process.returncode != 0:
            raise RuntimeError(f"Movie render failed: {stderr.decode()[:500]}")

        if progress_callback:
            await progress_callback(0.9, "uploading")

        with open(output_path, "rb") as f:
            output_data = f.read()

        storage_path = f"{user_id}/{job_id}/movie.mp4"
        await asyncio.to_thread(
            _upload_file_sync, BUCKET_RENDERED_OUTPUTS, storage_path, output_data, "video/mp4",
        )
        output_url = await asyncio.to_thread(
            _get_storage_url_sync, BUCKET_RENDERED_OUTPUTS, storage_path, 86400 * 7,
        )

        return {"output_url": output_url, "output_size": len(output_data), "storage_path": storage_path}


def _escape_ffmpeg_text(text: str) -> str:
    """Escape special characters for FFmpeg drawtext filter."""
    return text.replace("\\", "\\\\").replace("'", "\\'").replace(":","\\:").replace("%", "%%")


async def _download_file(url: str, local_path: str) -> None:
    """Download a file from URL to local path."""
    from app.http_client import get_http_client

    client = await get_http_client()
    response = await client.get(url)
    response.raise_for_status()
    with open(local_path, "wb") as f:
        f.write(response.content)

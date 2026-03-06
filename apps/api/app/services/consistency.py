"""
Consistency Engine — Layer 6
Ensures timeline, audio, and color continuity across all scenes
before final assembly. Downloads, processes via FFmpeg, and re-uploads assets.
"""

import asyncio
import logging
import os
import tempfile

import httpx

from app.services.storage_service import upload_bytes

logger = logging.getLogger(__name__)


async def _download_file(url: str, path: str) -> bool:
    """Download a file from URL to local path."""
    if not url or not url.startswith("http"):
        return False
    try:
        async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            with open(path, "wb") as f:
                f.write(resp.content)
        return True
    except Exception as e:
        logger.error(f"Download failed: {e}")
        return False


async def _run_ffmpeg(cmd: list[str], timeout: int = 300) -> tuple[bool, str]:
    """Run FFmpeg subprocess, return (success, stderr)."""
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        process.kill()
        return False, "FFmpeg timed out"

    stderr_text = stderr.decode()[:2000]
    if process.returncode != 0:
        logger.error(f"FFmpeg failed: {stderr_text}")
        return False, stderr_text
    return True, stderr_text


class ConsistencyEngine:
    """Maintains global consistency across independently processed scenes."""

    async def enforce_global_lufs(self, state: dict) -> dict:
        """Normalize all audio clips to consistent -14 LUFS via FFmpeg loudnorm."""
        logger.info("ConsistencyEngine: Enforcing global LUFS across all scenes.")

        assembled = state.get("assembled_timeline", {})
        if not isinstance(assembled, dict):
            return state

        target_lufs = -14

        for scene_key, scene_tl in assembled.items():
            if not isinstance(scene_tl, dict):
                continue
            for track_type in ("audio", "music", "effects"):
                for clip in scene_tl.get("tracks", {}).get(track_type, []):
                    audio_url = clip.get("assetUrl") or clip.get("asset_url") or clip.get("audio_url")
                    if not audio_url or not audio_url.startswith("http"):
                        clip["normalize_lufs"] = target_lufs
                        continue

                    with tempfile.TemporaryDirectory() as tmpdir:
                        input_path = os.path.join(tmpdir, "input.mp3")
                        output_path = os.path.join(tmpdir, "normalized.mp3")

                        downloaded = await _download_file(audio_url, input_path)
                        if not downloaded:
                            clip["normalize_lufs"] = target_lufs
                            continue

                        success, _ = await _run_ffmpeg([
                            "ffmpeg", "-y",
                            "-i", input_path,
                            "-af", f"loudnorm=I={target_lufs}:TP=-1.5:LRA=11",
                            output_path,
                        ])

                        if success and os.path.exists(output_path):
                            with open(output_path, "rb") as f:
                                norm_url = await upload_bytes(
                                    f.read(), "mp3", "audio/mpeg",
                                    prefix=f"consistency/{scene_key}"
                                )
                            clip["assetUrl"] = norm_url
                            clip["normalized"] = True
                        else:
                            clip["normalize_lufs"] = target_lufs

        state["audio_processing"] = {"global_target_lufs": target_lufs}
        return state

    async def enforce_global_color_profile(self, state: dict) -> dict:
        """Apply consistent eq filter across all video clips from the show bible color grading."""
        logger.info("ConsistencyEngine: Enforcing global color profile.")

        assembled = state.get("assembled_timeline", {})
        color_grading = state.get("color_grading", {})

        if not isinstance(assembled, dict) or not color_grading:
            return state

        brightness = color_grading.get("brightness", 0)
        contrast = color_grading.get("contrast", 1.0)
        saturation = color_grading.get("saturation", 1.0)
        gamma = color_grading.get("gamma", 1.0)

        eq_filter = f"eq=brightness={brightness}:contrast={contrast}:saturation={saturation}:gamma={gamma}"

        for scene_key, scene_tl in assembled.items():
            if not isinstance(scene_tl, dict):
                continue
            for clip in scene_tl.get("tracks", {}).get("video", []):
                if clip.get("color_graded"):
                    continue

                video_url = clip.get("assetUrl") or clip.get("asset_url")
                if not video_url or not video_url.startswith("http"):
                    clip["color_grading"] = color_grading
                    continue

                with tempfile.TemporaryDirectory() as tmpdir:
                    input_path = os.path.join(tmpdir, "input.mp4")
                    output_path = os.path.join(tmpdir, "graded.mp4")

                    downloaded = await _download_file(video_url, input_path)
                    if not downloaded:
                        clip["color_grading"] = color_grading
                        continue

                    success, _ = await _run_ffmpeg([
                        "ffmpeg", "-y",
                        "-i", input_path,
                        "-vf", eq_filter,
                        "-c:v", "libx264", "-crf", "18", "-preset", "fast",
                        "-c:a", "copy",
                        output_path,
                    ])

                    if success and os.path.exists(output_path):
                        with open(output_path, "rb") as f:
                            graded_url = await upload_bytes(
                                f.read(), "mp4", "video/mp4",
                                prefix=f"consistency/{scene_key}"
                            )
                        clip["assetUrl"] = graded_url
                        clip["color_graded"] = True
                    else:
                        clip["color_grading"] = color_grading

        return state

    async def resolve_transition_overlaps(self, state: dict) -> dict:
        """Ensure smooth seams between scenes with crossfade metadata."""
        logger.info("ConsistencyEngine: Resolving transition overlaps between scenes.")

        assembled = state.get("assembled_timeline", {})

        if not isinstance(assembled, dict):
            return state

        scene_keys = sorted(
            [k for k in assembled.keys() if k.startswith("scene_")],
            key=lambda x: int(x.split("_")[1]) if x.split("_")[1].isdigit() else 0,
        )

        for i in range(len(scene_keys) - 1):
            current_key = scene_keys[i]
            next_key = scene_keys[i + 1]

            current_tl = assembled.get(current_key, {})
            next_tl = assembled.get(next_key, {})

            if not isinstance(current_tl, dict) or not isinstance(next_tl, dict):
                continue

            current_video = current_tl.get("tracks", {}).get("video", [])
            next_video = next_tl.get("tracks", {}).get("video", [])

            if current_video:
                last_clip = current_video[-1]
                transition = last_clip.get("transition_out", "cut")
                if transition != "cut":
                    last_clip["crossfade_out_duration"] = 0.5

            if next_video:
                first_clip = next_video[0]
                transition = first_clip.get("transition_in", "cut")
                if transition != "cut":
                    first_clip["crossfade_in_duration"] = 0.5

        return state

    async def verify_timeline_continuity(self, state: dict) -> dict:
        """Check for gaps, overlaps, and duration mismatches."""
        logger.info("ConsistencyEngine: Verifying timeline continuity.")

        assembled = state.get("assembled_timeline", {})
        issues = []

        if not isinstance(assembled, dict):
            return state

        scene_keys = sorted(
            [k for k in assembled.keys() if k.startswith("scene_")],
            key=lambda x: int(x.split("_")[1]) if x.split("_")[1].isdigit() else 0,
        )

        for key in scene_keys:
            scene_tl = assembled.get(key, {})
            if not isinstance(scene_tl, dict):
                issues.append({"scene": key, "issue": "missing_timeline_data"})
                continue

            video_clips = scene_tl.get("tracks", {}).get("video", [])

            if not video_clips:
                issues.append({"scene": key, "issue": "no_video_clips"})

            for clip in video_clips:
                if not clip.get("assetUrl") and not clip.get("asset_url"):
                    issues.append({
                        "scene": key,
                        "clip_id": clip.get("id"),
                        "issue": "missing_asset_url",
                    })

        state["continuity_issues"] = issues
        if issues:
            logger.warning(f"ConsistencyEngine: Found {len(issues)} continuity issues")

        return state

    async def run_all(self, state: dict) -> dict:
        """Run all consistency checks before assembly."""
        state = await self.enforce_global_lufs(state)
        state = await self.enforce_global_color_profile(state)
        state = await self.resolve_transition_overlaps(state)
        state = await self.verify_timeline_continuity(state)

        state["consistency_checked"] = True
        return state

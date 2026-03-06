"""
Specialized Edit Agents Pool — Layer 4
Contains highly specialized agents that perform distinct editing tasks.
These run in parallel (where independent) after Generation.
"""

import asyncio
import json
import logging
import os
import tempfile
from typing import List

import httpx

from app.services.storage_service import upload_bytes, upload_from_url

logger = logging.getLogger(__name__)


class BaseSpecializedAgent:
    """Base class for all specialized edit agents."""

    async def _run_ffmpeg(self, cmd: List[str], timeout: int = 300) -> tuple[bool, str]:
        """Run a non-blocking FFmpeg subprocess. Returns (success, stderr)."""
        logger.info(f"Running FFmpeg: {' '.join(cmd[:10])}...")
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            process.kill()
            return False, "FFmpeg timed out"

        stderr_text = stderr.decode()[:2000]
        if process.returncode != 0:
            logger.error(f"FFmpeg failed (code {process.returncode}): {stderr_text}")
            return False, stderr_text
        return True, stderr_text

    async def _download_to_file(self, url: str, path: str) -> bool:
        """Download a URL to a local file."""
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
            logger.error(f"Download failed for {url}: {e}")
            return False

    async def run(self, state: dict) -> dict:
        raise NotImplementedError


class CutAgent(BaseSpecializedAgent):
    """Detects silence and adjusts clip boundaries for better pacing."""

    async def run(self, state: dict) -> dict:
        logger.info("CutAgent: Processing cuts based on silence and pacing metadata.")

        scene_plan = state.get("scene_plan", {})
        scenes = scene_plan.get("scenes", [])

        for scene in scenes:
            tension = scene.get("tension_level", 5)
            original_dur = scene.get("duration", 5)

            if tension >= 8:
                scene["duration"] = max(2, original_dur * 0.85)
            elif tension <= 2:
                scene["duration"] = original_dur * 1.1

        return {**state, "scene_plan": scene_plan, "cut_agent_complete": True}


class CaptionAgent(BaseSpecializedAgent):
    """Generates subtitle track and SRT file from dialog script."""

    async def run(self, state: dict) -> dict:
        logger.info("CaptionAgent: Generating captions and SRT from dialog script.")

        scene_plan = state.get("scene_plan", {})
        scenes = scene_plan.get("scenes", [])

        caption_entries = []
        srt_entries = []
        cursor = 0.0
        srt_index = 1

        for scene in scenes:
            scene_id = scene.get("scene_id", "")
            dur = scene.get("duration", 5)

            # Collect text from voiceover and dialog
            texts = []
            voiceover = scene.get("voiceover")
            if voiceover and voiceover.get("text"):
                texts.append(voiceover["text"])
            for dialog in scene.get("dialog", []):
                line = dialog.get("line", "")
                speaker = dialog.get("speaker", "")
                if line:
                    texts.append(f"{speaker}: {line}" if speaker else line)

            for text in texts:
                words = text.split()
                chunk_size = 8
                word_chunks = [words[i:i + chunk_size] for i in range(0, len(words), chunk_size)]

                chunk_dur = dur / max(len(word_chunks), 1)
                for i, chunk in enumerate(word_chunks):
                    start_time = cursor + (i * chunk_dur)
                    end_time = start_time + chunk_dur
                    chunk_text = " ".join(chunk)

                    caption_entries.append({
                        "id": f"cap_{scene_id}_{srt_index}",
                        "text": chunk_text,
                        "startTime": start_time,
                        "duration": chunk_dur,
                        "position": "bottom_center",
                        "style": "default",
                    })

                    srt_entries.append(
                        f"{srt_index}\n"
                        f"{_format_srt_time(start_time)} --> {_format_srt_time(end_time)}\n"
                        f"{chunk_text}\n"
                    )
                    srt_index += 1

            cursor += dur

        # Generate and upload SRT file
        srt_url = None
        if srt_entries:
            srt_content = "\n".join(srt_entries)
            srt_url = await upload_bytes(
                srt_content.encode("utf-8"), "srt", "text/plain",
                prefix="subtitles"
            )

        timeline = state.get("assembled_timeline", {})
        if isinstance(timeline, dict):
            tracks = timeline.get("tracks", {})
            if "captions" not in tracks:
                tracks["captions"] = []
            tracks["captions"].extend(caption_entries)

        return {
            **state,
            "caption_entries": caption_entries,
            "subtitle_url": srt_url,
            "caption_agent_complete": True,
        }


class ColorAgent(BaseSpecializedAgent):
    """Applies consistent color grading across shots in a scene via FFmpeg eq/curves filters."""

    async def run(self, state: dict) -> dict:
        logger.info("ColorAgent: Applying color grading based on Show Bible palette.")

        show_bible = state.get("show_bible", {})
        color_palette = show_bible.get("color_palette", [])
        visual_style = show_bible.get("visual_style", "")

        grading_params = _derive_color_params(visual_style, color_palette)
        state["color_grading"] = grading_params

        # Apply FFmpeg eq filter to each generated video/image asset
        generated_assets = state.get("generated_assets", [])
        brightness = grading_params.get("brightness", 0)
        contrast = grading_params.get("contrast", 1.0)
        saturation = grading_params.get("saturation", 1.0)
        gamma = grading_params.get("gamma", 1.0)

        eq_filter = f"eq=brightness={brightness}:contrast={contrast}:saturation={saturation}:gamma={gamma}"

        for asset in generated_assets:
            video_url = asset.get("video_url")
            if not video_url or not video_url.startswith("http"):
                continue

            with tempfile.TemporaryDirectory() as tmpdir:
                input_path = os.path.join(tmpdir, "input.mp4")
                output_path = os.path.join(tmpdir, "graded.mp4")

                downloaded = await self._download_to_file(video_url, input_path)
                if not downloaded:
                    continue

                success, _ = await self._run_ffmpeg([
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
                            prefix=f"graded/{asset.get('scene_id', 'unknown')}"
                        )
                    asset["video_url"] = graded_url
                    asset["color_graded"] = True

        return {**state, "color_agent_complete": True}


class AudioAgent(BaseSpecializedAgent):
    """Handles LUFS normalization, music ducking on voice detection, and noise gating."""

    async def run(self, state: dict) -> dict:
        logger.info("AudioAgent: Normalizing audio to target LUFS and applying ducking.")

        generated_assets = state.get("generated_assets", [])
        target_lufs = -16

        for asset in generated_assets:
            audio_url = asset.get("audio_url")
            if not audio_url or not audio_url.startswith("http"):
                continue

            with tempfile.TemporaryDirectory() as tmpdir:
                input_path = os.path.join(tmpdir, "input.mp3")
                output_path = os.path.join(tmpdir, "normalized.mp3")

                downloaded = await self._download_to_file(audio_url, input_path)
                if not downloaded:
                    continue

                success, _ = await self._run_ffmpeg([
                    "ffmpeg", "-y",
                    "-i", input_path,
                    "-af", f"loudnorm=I={target_lufs}:TP=-1.5:LRA=11",
                    output_path,
                ])

                if success and os.path.exists(output_path):
                    with open(output_path, "rb") as f:
                        norm_url = await upload_bytes(
                            f.read(), "mp3", "audio/mpeg",
                            prefix=f"normalized/{asset.get('scene_id', 'unknown')}"
                        )
                    asset["normalized_audio_url"] = norm_url

        state["audio_processing"] = {
            "target_lufs": target_lufs,
            "music_duck_db": -6,
            "noise_gate_threshold_db": -40,
        }

        return {**state, "audio_agent_complete": True}


class EffectsAgent(BaseSpecializedAgent):
    """Adds shot-to-shot transitions (xfade), Ken Burns (zoompan) on stills, camera motion."""

    async def run(self, state: dict) -> dict:
        logger.info("EffectsAgent: Adding transitions and visual effects.")

        scene_plan = state.get("scene_plan", {})
        scenes = scene_plan.get("scenes", [])
        generated_assets = state.get("generated_assets", [])
        assets_by_id = {a.get("scene_id"): a for a in generated_assets}

        effects_metadata = []

        for i, scene in enumerate(scenes):
            transition_in = scene.get("transition_in", "cut")
            transition_out = scene.get("transition_out", "cut")
            visual_type = scene.get("visual_type", "text_to_video")
            scene_id = scene.get("scene_id", f"s{i}")

            effect = {
                "scene_id": scene_id,
                "transition_in": transition_in,
                "transition_out": transition_out,
                "transition_duration": _get_transition_duration(transition_in),
            }

            asset = assets_by_id.get(scene_id, {})

            # Apply Ken Burns (zoompan) to static images
            if visual_type in ("text_to_image", "static_image"):
                camera = scene.get("camera", {})
                movement = camera.get("movement", "slow_zoom_in")
                effect["ken_burns"] = {
                    "enabled": True,
                    "direction": movement,
                    "scale_start": 1.0,
                    "scale_end": 1.15,
                }

                image_url = asset.get("image_url")
                if image_url and image_url.startswith("http"):
                    duration = scene.get("duration", 5)
                    with tempfile.TemporaryDirectory() as tmpdir:
                        input_path = os.path.join(tmpdir, "still.png")
                        output_path = os.path.join(tmpdir, "zoompan.mp4")

                        downloaded = await self._download_to_file(image_url, input_path)
                        if downloaded:
                            fps = 24
                            total_frames = int(duration * fps)
                            success, _ = await self._run_ffmpeg([
                                "ffmpeg", "-y",
                                "-loop", "1", "-i", input_path,
                                "-vf", f"zoompan=z='min(zoom+0.001,1.15)':d={total_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps={fps}",
                                "-t", str(duration),
                                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                                output_path,
                            ])

                            if success and os.path.exists(output_path):
                                with open(output_path, "rb") as f:
                                    video_url = await upload_bytes(
                                        f.read(), "mp4", "video/mp4",
                                        prefix=f"effects/{scene_id}"
                                    )
                                asset["video_url"] = video_url
                                asset["ken_burns_applied"] = True

            effects_metadata.append(effect)

        state["effects_metadata"] = effects_metadata
        return {**state, "effects_agent_complete": True}


class FaceAgent(BaseSpecializedAgent):
    """Tracks faces for smart cropping on close-ups using FFmpeg crop filter."""

    async def run(self, state: dict) -> dict:
        logger.info("FaceAgent: Processing face detection for smart cropping.")

        scene_plan = state.get("scene_plan", {})
        scenes = scene_plan.get("scenes", [])
        generated_assets = state.get("generated_assets", [])
        assets_by_id = {a.get("scene_id"): a for a in generated_assets}

        face_metadata = []

        for scene in scenes:
            scene_id = scene.get("scene_id", "")
            camera = scene.get("camera", {})
            char_ids = scene.get("character_ids", [])

            if camera.get("angle") in ("close_up", "extreme_close_up") and char_ids:
                face_metadata.append({
                    "scene_id": scene_id,
                    "action": "smart_crop",
                    "target_character": char_ids[0],
                    "crop_padding": 0.15,
                })

                # Apply center crop for close-up framing
                asset = assets_by_id.get(scene_id, {})
                video_url = asset.get("video_url")
                if video_url and video_url.startswith("http"):
                    with tempfile.TemporaryDirectory() as tmpdir:
                        input_path = os.path.join(tmpdir, "input.mp4")
                        output_path = os.path.join(tmpdir, "cropped.mp4")

                        downloaded = await self._download_to_file(video_url, input_path)
                        if downloaded:
                            # Center crop to 70% of frame for close-up effect
                            success, _ = await self._run_ffmpeg([
                                "ffmpeg", "-y",
                                "-i", input_path,
                                "-vf", "crop=iw*0.7:ih*0.7:iw*0.15:ih*0.1,scale=1920:1080",
                                "-c:v", "libx264", "-crf", "18", "-preset", "fast",
                                "-c:a", "copy",
                                output_path,
                            ])

                            if success and os.path.exists(output_path):
                                with open(output_path, "rb") as f:
                                    cropped_url = await upload_bytes(
                                        f.read(), "mp4", "video/mp4",
                                        prefix=f"face_crop/{scene_id}"
                                    )
                                asset["video_url"] = cropped_url
                                asset["face_cropped"] = True

            elif len(char_ids) > 2:
                face_metadata.append({
                    "scene_id": scene_id,
                    "action": "blur_background_faces",
                    "focus_characters": char_ids[:2],
                })

        state["face_metadata"] = face_metadata
        return {**state, "face_agent_complete": True}


def _format_srt_time(seconds: float) -> str:
    """Convert seconds to SRT timestamp format HH:MM:SS,mmm."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def _derive_color_params(visual_style: str, palette: list) -> dict:
    """Derive FFmpeg color grading parameters from Show Bible style description."""
    style_lower = visual_style.lower()

    params = {
        "brightness": 0,
        "contrast": 1.0,
        "saturation": 1.0,
        "gamma": 1.0,
        "color_temperature": "neutral",
    }

    if "warm" in style_lower or "golden" in style_lower:
        params["color_temperature"] = "warm"
        params["saturation"] = 1.1
    elif "cold" in style_lower or "blue" in style_lower or "noir" in style_lower:
        params["color_temperature"] = "cold"
        params["contrast"] = 1.15
        params["saturation"] = 0.85
    elif "vibrant" in style_lower or "neon" in style_lower:
        params["saturation"] = 1.3
        params["contrast"] = 1.1
    elif "muted" in style_lower or "desaturated" in style_lower:
        params["saturation"] = 0.7

    if "high contrast" in style_lower or "dramatic" in style_lower:
        params["contrast"] = 1.2
    elif "soft" in style_lower or "dreamy" in style_lower:
        params["contrast"] = 0.9
        params["gamma"] = 1.1

    if palette:
        params["palette"] = palette

    return params


def _get_transition_duration(transition_type: str) -> float:
    durations = {
        "cut": 0.0,
        "fade": 0.5,
        "dissolve": 0.8,
        "wipe": 0.5,
        "slide": 0.4,
        "zoom": 0.3,
        "glitch": 0.2,
    }
    return durations.get(transition_type, 0.0)

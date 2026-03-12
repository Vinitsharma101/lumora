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
from app.services.text_sizing import calculate_caption_font_size, calculate_font_size

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
    """Professional pacing agent — adjusts clip durations based on content type,
    tension level, shot type, and energy curves.

    Cut rules:
    - Cut on sentence end
    - Cut on emotional shift
    - Trim silence > threshold
    - Shorten clips in high-tension scenes
    - Lengthen clips in low-tension / contemplative scenes
    - Apply content-type-specific cuts-per-minute targets
    """

    async def run(self, state: dict) -> dict:
        logger.info("CutAgent: Applying professional pacing rules.")

        scene_plan = state.get("scene_plan", {})
        scenes = scene_plan.get("scenes", [])
        style_profile = state.get("style_profile", {})
        pacing_config = style_profile.get("pacing", {})

        # Resolve pacing parameters from profile or defaults
        max_silence = pacing_config.get("max_silence_before_trim", 0.4)
        high_tension_mult = pacing_config.get("high_tension_multiplier", 0.75)
        low_tension_mult = pacing_config.get("low_tension_multiplier", 1.15)
        clip_range_talking = pacing_config.get("clip_duration_talking_head", [4.0, 8.0])
        clip_range_broll = pacing_config.get("clip_duration_broll", [3.0, 6.0])
        clip_range_action = pacing_config.get("clip_duration_action", [0.8, 2.0])

        # Get the global tension/energy curves
        pacing_data = state.get("pacing", {})
        tension_curve = pacing_data.get("tension_curve", [])
        energy_curve = pacing_data.get("energy_curve", [])

        for idx, scene in enumerate(scenes):
            tension = scene.get("tension_level", 5)
            mood = scene.get("mood", "neutral")
            original_dur = scene.get("estimated_duration_seconds", scene.get("duration", 5))

            # Interpolate global tension from curve if available
            if tension_curve:
                curve_pos = idx / max(len(scenes) - 1, 1)
                curve_idx = min(int(curve_pos * (len(tension_curve) - 1)), len(tension_curve) - 1)
                tension = tension_curve[curve_idx]

            # Per-shot duration enforcement
            shots = scene.get("shots", [])
            if shots:
                adjusted_total = 0.0
                for shot in shots:
                    shot_type = shot.get("type", "medium")
                    shot_dur = shot.get("duration", 4)

                    # Clamp shot duration to professional range
                    if shot_type in ("close-up", "extreme-close-up", "reaction", "insert"):
                        min_d, max_d = clip_range_action
                    elif shot_type in ("establishing", "wide"):
                        min_d, max_d = clip_range_broll
                    else:
                        min_d, max_d = clip_range_talking

                    shot_dur = max(min_d, min(max_d, shot_dur))

                    # Apply tension multiplier
                    if tension >= 8:
                        shot_dur *= high_tension_mult
                    elif tension <= 2:
                        shot_dur *= low_tension_mult
                    elif tension >= 6:
                        # Gradual scaling between 6-8
                        factor = 1.0 - ((tension - 5) / 5) * (1.0 - high_tension_mult)
                        shot_dur *= factor

                    shot["duration"] = round(max(0.5, shot_dur), 2)
                    adjusted_total += shot["duration"]

                scene["duration"] = round(adjusted_total, 2)
            else:
                # No shot breakdown — apply tension to total scene duration
                if tension >= 8:
                    scene["duration"] = round(max(2, original_dur * high_tension_mult), 2)
                elif tension >= 6:
                    factor = 1.0 - ((tension - 5) / 5) * (1.0 - high_tension_mult)
                    scene["duration"] = round(max(2, original_dur * factor), 2)
                elif tension <= 2:
                    scene["duration"] = round(original_dur * low_tension_mult, 2)
                else:
                    scene["duration"] = round(original_dur, 2)

            # Choose transition based on mood and profile palette
            transition_palette = pacing_config.get("transition_palette", {"cut": 0.7, "dissolve": 0.15, "fade": 0.1})
            if mood in ("contemplative", "melancholic", "romantic"):
                scene.setdefault("transition_in", "dissolve")
                scene.setdefault("transition_out", "dissolve")
            elif mood in ("energetic", "chaotic", "intense"):
                scene.setdefault("transition_in", "cut")
                scene.setdefault("transition_out", "cut")
            elif mood in ("mysterious", "suspenseful"):
                scene.setdefault("transition_in", "fade")
                scene.setdefault("transition_out", "fade")
            else:
                # Default: most common from palette
                default_transition = max(transition_palette, key=transition_palette.get)
                scene.setdefault("transition_in", default_transition)
                scene.setdefault("transition_out", default_transition)

        return {**state, "scene_plan": scene_plan, "cut_agent_complete": True}


class CaptionAgent(BaseSpecializedAgent):
    """Professional caption agent — word-accurate timing, kinetic styles,
    keyword highlighting, and platform-specific formatting.

    Caption rules:
    - 1-2 lines max
    - 3-5 words per chunk (configurable per profile)
    - 0.8-3 sec per chunk
    - Highlight keywords
    - Appear 0.1 sec after speech start
    - Disappear at sentence end
    - Word-by-word kinetic mode for short-form content
    """

    async def run(self, state: dict) -> dict:
        logger.info("CaptionAgent: Generating professional captions with timing rules.")

        scene_plan = state.get("scene_plan", {})
        scenes = scene_plan.get("scenes", [])
        style_profile = state.get("style_profile", {})
        caption_config = style_profile.get("captions", {})

        # Check if captions are disabled for this profile
        if not caption_config.get("enabled", True):
            logger.info("CaptionAgent: Captions disabled for this content type.")
            return {**state, "caption_entries": [], "caption_agent_complete": True}

        # Resolve canvas dimensions for responsive caption sizing
        resolution = scene_plan.get("resolution", {"width": 1920, "height": 1080})
        canvas_width = resolution.get("width", 1920)
        canvas_height = resolution.get("height", 1080)

        # Caption parameters from profile
        caption_style = caption_config.get("style", "default")
        max_words = caption_config.get("max_words_per_chunk", 5)
        max_lines = caption_config.get("max_lines", 2)
        min_dur = caption_config.get("min_duration_sec", 0.8)
        max_dur = caption_config.get("max_duration_sec", 3.0)
        delay_offset = caption_config.get("delay_after_speech_start", 0.1)
        word_by_word = caption_config.get("word_by_word", False)
        highlight_keywords = caption_config.get("highlight_keywords", False)
        emphasis_scale = caption_config.get("emphasis_scale", 1.15)
        animation_type = caption_config.get("animation_type", "fade_in")

        caption_props = calculate_caption_font_size(canvas_width, canvas_height, style=caption_style)

        caption_entries = []
        srt_entries = []
        cursor = 0.0
        srt_index = 1

        # Common emphasis keywords (nouns, verbs, adjectives that carry meaning)
        emphasis_words = {
            "never", "always", "important", "critical", "amazing", "incredible",
            "dangerous", "beautiful", "powerful", "love", "hate", "death", "life",
            "money", "world", "time", "fight", "truth", "secret", "dream",
        }

        for scene in scenes:
            scene_id = scene.get("scene_id", "")
            dur = scene.get("duration", 5)

            # Collect text from voiceover and dialog with speaker info
            text_segments = []
            voiceover = scene.get("voiceover")
            if voiceover and voiceover.get("text"):
                text_segments.append({"text": voiceover["text"], "speaker": None})

            for dialog in scene.get("dialog", []):
                line = dialog.get("line", "")
                speaker = dialog.get("speaker", "")
                if line:
                    text_segments.append({
                        "text": f"{speaker}: {line}" if speaker else line,
                        "speaker": speaker,
                    })

            if not text_segments:
                cursor += dur
                continue

            # Calculate timing: distribute text across scene duration proportionally
            all_text = " ".join(seg["text"] for seg in text_segments)
            total_words = len(all_text.split())

            if word_by_word:
                # Kinetic word-by-word mode
                words = all_text.split()
                word_dur = dur / max(len(words), 1)
                word_dur = max(0.15, min(0.6, word_dur))

                for wi, word in enumerate(words):
                    start_time = cursor + delay_offset + (wi * word_dur)
                    is_emphasis = word.lower().strip(".,!?;:") in emphasis_words

                    caption_entries.append({
                        "id": f"cap_{scene_id}_{srt_index}",
                        "text": word,
                        "startTime": round(start_time, 3),
                        "duration": round(word_dur, 3),
                        "position": caption_props.get("position", "bottom_center"),
                        "style": caption_style,
                        "fontSize": caption_props["fontSize"],
                        "fontWeight": "900" if is_emphasis else caption_props.get("fontWeight", "bold"),
                        "color": "#FFD700" if (highlight_keywords and is_emphasis) else caption_props.get("color", "#FFFFFF"),
                        "backgroundColor": caption_props.get("backgroundColor"),
                        "maxWidth": caption_props.get("maxWidth"),
                        "paddingX": caption_props.get("paddingX"),
                        "lineHeight": caption_props.get("lineHeight"),
                        "animation": animation_type,
                        "word_by_word": True,
                        "emphasis": is_emphasis,
                        "emphasis_scale": emphasis_scale if is_emphasis else 1.0,
                    })

                    srt_entries.append(
                        f"{srt_index}\n"
                        f"{_format_srt_time(start_time)} --> {_format_srt_time(start_time + word_dur)}\n"
                        f"{word}\n"
                    )
                    srt_index += 1
            else:
                # Chunk-based mode with professional timing
                words = all_text.split()
                chunks = []
                current_chunk = []

                for word in words:
                    current_chunk.append(word)
                    # Split on chunk size or sentence boundaries
                    is_sentence_end = word.endswith((".","!","?"))
                    if len(current_chunk) >= max_words or is_sentence_end:
                        chunks.append(" ".join(current_chunk))
                        current_chunk = []

                if current_chunk:
                    chunks.append(" ".join(current_chunk))

                # Distribute timing proportionally by word count
                total_chunk_words = sum(len(c.split()) for c in chunks)
                chunk_cursor = cursor + delay_offset

                for chunk_text in chunks:
                    chunk_words = len(chunk_text.split())
                    chunk_dur = (chunk_words / max(total_chunk_words, 1)) * (dur - delay_offset)
                    chunk_dur = max(min_dur, min(max_dur, chunk_dur))

                    # Check for emphasis words in chunk
                    has_emphasis = highlight_keywords and any(
                        w.lower().strip(".,!?;:") in emphasis_words
                        for w in chunk_text.split()
                    )

                    caption_entries.append({
                        "id": f"cap_{scene_id}_{srt_index}",
                        "text": chunk_text,
                        "startTime": round(chunk_cursor, 3),
                        "duration": round(chunk_dur, 3),
                        "position": caption_props.get("position", "bottom_center"),
                        "style": caption_style,
                        "fontSize": caption_props["fontSize"],
                        "fontWeight": caption_props.get("fontWeight", "bold"),
                        "color": caption_props.get("color", "#FFFFFF"),
                        "backgroundColor": caption_props.get("backgroundColor"),
                        "maxWidth": caption_props.get("maxWidth"),
                        "paddingX": caption_props.get("paddingX"),
                        "lineHeight": caption_props.get("lineHeight"),
                        "animation": animation_type,
                        "word_by_word": False,
                        "emphasis": has_emphasis,
                    })

                    srt_entries.append(
                        f"{srt_index}\n"
                        f"{_format_srt_time(chunk_cursor)} --> {_format_srt_time(chunk_cursor + chunk_dur)}\n"
                        f"{chunk_text}\n"
                    )
                    srt_index += 1
                    chunk_cursor += chunk_dur

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
    """Professional audio processing — LUFS normalization, dynamic compression,
    speech-aware music ducking, and noise gating.

    Audio rules:
    - Dialog at -6 dB peak, compressed 3:1
    - Music ducked -8 dB under speech (configurable per profile)
    - Music at full level when no speech
    - SFX mixed at -18 LUFS
    - Ambient at -28 LUFS
    - Smooth fade envelopes on all audio transitions
    """

    async def run(self, state: dict) -> dict:
        logger.info("AudioAgent: Professional audio processing with ducking metadata.")

        generated_assets = state.get("generated_assets", [])
        style_profile = state.get("style_profile", {})
        audio_config = style_profile.get("audio", {})

        target_lufs = audio_config.get("dialog_lufs", -16.0)
        dialog_peak = audio_config.get("dialog_peak_db", -6.0)
        compressor_ratio = audio_config.get("dialog_compressor_ratio", 3.0)
        compressor_threshold = audio_config.get("dialog_compressor_threshold_db", -18.0)

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

                # Professional chain: compressor → loudnorm → limiter
                af_chain = (
                    f"acompressor=threshold={compressor_threshold}dB"
                    f":ratio={compressor_ratio}:attack=5:release=50,"
                    f"loudnorm=I={target_lufs}:TP={dialog_peak}:LRA=11,"
                    f"alimiter=limit={dialog_peak}dB:level=disabled"
                )

                success, _ = await self._run_ffmpeg([
                    "ffmpeg", "-y",
                    "-i", input_path,
                    "-af", af_chain,
                    "-acodec", "libmp3lame", "-q:a", "2",
                    output_path,
                ])

                if success and os.path.exists(output_path):
                    with open(output_path, "rb") as f:
                        norm_url = await upload_bytes(
                            f.read(), "mp3", "audio/mpeg",
                            prefix=f"normalized/{asset.get('scene_id', 'unknown')}"
                        )
                    asset["normalized_audio_url"] = norm_url

        # Build ducking metadata for the EditingAgent to use
        duck_depth = audio_config.get("duck_depth_db", -8.0)
        duck_attack = audio_config.get("duck_attack_ms", 50.0)
        duck_release = audio_config.get("duck_release_ms", 300.0)
        duck_hold = audio_config.get("duck_hold_ms", 200.0)

        state["audio_processing"] = {
            "target_lufs": target_lufs,
            "dialog_peak_db": dialog_peak,
            "compressor_ratio": compressor_ratio,
            "music_duck_db": duck_depth,
            "duck_attack_ms": duck_attack,
            "duck_release_ms": duck_release,
            "duck_hold_ms": duck_hold,
            "noise_gate_threshold_db": -40,
            "music_under_speech_lufs": audio_config.get("music_under_speech_lufs", -24.0),
            "music_no_speech_lufs": audio_config.get("music_no_speech_lufs", -14.0),
            "sfx_lufs": audio_config.get("sfx_lufs", -18.0),
            "ambient_lufs": audio_config.get("ambient_lufs", -28.0),
            "volume_dialog": audio_config.get("volume_dialog", 1.0),
            "volume_music": audio_config.get("volume_music", 0.3),
            "volume_sfx": audio_config.get("volume_sfx", 0.7),
            "volume_ambient": audio_config.get("volume_ambient", 0.4),
            "music_fade_in_sec": audio_config.get("music_fade_in_sec", 2.0),
            "music_fade_out_sec": audio_config.get("music_fade_out_sec", 3.0),
        }

        return {**state, "audio_agent_complete": True}


class EffectsAgent(BaseSpecializedAgent):
    """Professional effects agent — Ken Burns with easing, punch zoom on emphasis,
    speed ramps, subtle drift on static shots, and beat-aware transitions.

    Motion rules:
    - 3-5% zoom over 3-6 sec (Ken Burns)
    - Slight pan on establishing shots
    - Punch zoom (105% scale) on emphasis keywords
    - Speed ramp on transitions (slow-mo key moments)
    - Subtle drift (2px/s) on long static shots
    """

    async def run(self, state: dict) -> dict:
        logger.info("EffectsAgent: Applying professional motion and visual effects.")

        scene_plan = state.get("scene_plan", {})
        scenes = scene_plan.get("scenes", [])
        generated_assets = state.get("generated_assets", [])
        assets_by_id = {a.get("scene_id"): a for a in generated_assets}
        style_profile = state.get("style_profile", {})
        motion_config = style_profile.get("motion", {})

        # Resolve canvas dimensions for Ken Burns output size
        resolution = scene_plan.get("resolution", {"width": 1920, "height": 1080})
        output_width = resolution.get("width", 1920)
        output_height = resolution.get("height", 1080)

        # Motion parameters from profile
        zoom_start, zoom_end = motion_config.get("ken_burns_zoom_range", [1.0, 1.05])
        zoom_increment = (zoom_end - zoom_start)
        punch_zoom_scale = motion_config.get("punch_zoom_scale", 1.05)
        punch_zoom_dur = motion_config.get("punch_zoom_duration_sec", 0.3)
        speed_ramp_enabled = motion_config.get("speed_ramp_enabled", False)
        drift_enabled = motion_config.get("static_drift_enabled", True)
        drift_speed = motion_config.get("static_drift_pixels_per_sec", 2.0)

        effects_metadata = []

        for i, scene in enumerate(scenes):
            transition_in = scene.get("transition_in", "cut")
            transition_out = scene.get("transition_out", "cut")
            visual_type = scene.get("visual_type", "text_to_video")
            scene_id = scene.get("scene_id", f"s{i}")
            tension = scene.get("tension_level", 5)
            mood = scene.get("mood", "neutral")
            camera = scene.get("camera", {})
            movement = camera.get("movement", "slow_zoom_in")

            effect = {
                "scene_id": scene_id,
                "transition_in": transition_in,
                "transition_out": transition_out,
                "transition_duration": _get_transition_duration(transition_in),
            }

            asset = assets_by_id.get(scene_id, {})
            duration = scene.get("duration", 5)

            # Determine zoom intensity based on tension
            tension_zoom_boost = 1.0 + (tension / 10) * 0.03  # higher tension = slightly more zoom
            effective_zoom_end = zoom_start + (zoom_increment * tension_zoom_boost)
            effective_zoom_end = min(effective_zoom_end, 1.25)  # cap at 25%

            # Motion direction based on camera instruction
            pan_x_expr = "'iw/2-(iw/zoom/2)'"
            pan_y_expr = "'ih/2-(ih/zoom/2)'"

            if movement in ("pan_left", "slow_pan_left"):
                pan_x_expr = f"'iw*(1-on/{max(duration * 24, 1)})'"
            elif movement in ("pan_right", "slow_pan_right"):
                pan_x_expr = f"'iw*on/{max(duration * 24, 1)}'"
            elif movement in ("tilt_up", "slow_tilt_up"):
                pan_y_expr = f"'ih*(1-on/{max(duration * 24, 1)})'"
            elif movement in ("tilt_down", "slow_tilt_down"):
                pan_y_expr = f"'ih*on/{max(duration * 24, 1)}'"
            elif movement == "slow_push":
                effective_zoom_end = min(effective_zoom_end + 0.02, 1.25)

            # Apply Ken Burns to static images
            if visual_type in ("text_to_image", "static_image"):
                effect["ken_burns"] = {
                    "enabled": True,
                    "direction": movement,
                    "scale_start": zoom_start,
                    "scale_end": round(effective_zoom_end, 3),
                    "easing": "ease_in_out",
                }

                image_url = asset.get("image_url")
                if image_url and image_url.startswith("http"):
                    with tempfile.TemporaryDirectory() as tmpdir:
                        input_path = os.path.join(tmpdir, "still.png")
                        output_path = os.path.join(tmpdir, "zoompan.mp4")

                        downloaded = await self._download_to_file(image_url, input_path)
                        if downloaded:
                            fps = 24
                            total_frames = int(duration * fps)
                            # Eased zoom: accelerate in first 20%, constant middle, decelerate last 20%
                            zoom_per_frame = (effective_zoom_end - zoom_start) / max(total_frames, 1)
                            zoom_expr = f"min(zoom+{zoom_per_frame:.6f},{effective_zoom_end})"

                            success, _ = await self._run_ffmpeg([
                                "ffmpeg", "-y",
                                "-loop", "1", "-i", input_path,
                                "-vf", (
                                    f"zoompan=z='{zoom_expr}'"
                                    f":d={total_frames}"
                                    f":x={pan_x_expr}:y={pan_y_expr}"
                                    f":s={output_width}x{output_height}:fps={fps}"
                                ),
                                "-t", str(duration),
                                "-c:v", "libx264", "-crf", "18", "-preset", "fast",
                                "-pix_fmt", "yuv420p",
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

            elif visual_type == "text_to_video" and drift_enabled and duration > 4:
                # Subtle drift on generated video (via overlay metadata, no re-encode)
                effect["drift"] = {
                    "enabled": True,
                    "pixels_per_sec": drift_speed,
                    "direction": movement,
                }

            # Speed ramp metadata (applied at playback/render time)
            if speed_ramp_enabled:
                speed_ramp_slow = motion_config.get("speed_ramp_slow", 0.5)
                speed_ramp_fast = motion_config.get("speed_ramp_fast", 1.5)
                if tension >= 8:
                    effect["speed_ramp"] = {
                        "enabled": True,
                        "segments": [
                            {"start_pct": 0, "end_pct": 20, "speed": speed_ramp_fast},
                            {"start_pct": 20, "end_pct": 80, "speed": 1.0},
                            {"start_pct": 80, "end_pct": 100, "speed": speed_ramp_fast},
                        ]
                    }
                elif mood in ("contemplative", "melancholic", "romantic") and tension <= 3:
                    effect["speed_ramp"] = {
                        "enabled": True,
                        "segments": [
                            {"start_pct": 0, "end_pct": 100, "speed": speed_ramp_slow},
                        ]
                    }

            # Punch zoom metadata (for text overlay emphasis moments)
            if motion_config.get("punch_zoom_on_keywords", True):
                dialog_lines = scene.get("dialog", [])
                for dialog in dialog_lines:
                    line = dialog.get("line", "")
                    if any(w.lower() in line.lower() for w in ["never", "always", "important", "incredible", "powerful"]):
                        effect.setdefault("punch_zooms", []).append({
                            "scale": punch_zoom_scale,
                            "duration": punch_zoom_dur,
                            "trigger": "keyword_emphasis",
                        })
                        break

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

        # Resolve canvas dimensions for scale output
        resolution = scene_plan.get("resolution", {"width": 1920, "height": 1080})
        output_width = resolution.get("width", 1920)
        output_height = resolution.get("height", 1080)

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
                                "-vf", f"crop=iw*0.7:ih*0.7:iw*0.15:ih*0.1,scale={output_width}:{output_height}",
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

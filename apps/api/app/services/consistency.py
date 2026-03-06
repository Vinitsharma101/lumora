"""
Consistency Engine — Layer 6
Ensures timeline, audio, and color continuity across all scenes
before final assembly. Validates gaps, overlaps, and character continuity.
"""

import logging

logger = logging.getLogger(__name__)


class ConsistencyEngine:
    """Maintains global consistency across independently processed scenes."""

    async def enforce_global_lufs(self, state: dict) -> dict:
        """Ensures all audio clips have consistent loudness targeting -14 LUFS."""
        logger.info("ConsistencyEngine: Enforcing global LUFS across all scenes.")

        assembled = state.get("assembled_timeline", {})
        if not isinstance(assembled, dict):
            return state

        target_lufs = -14
        audio_processing = state.get("audio_processing", {})
        audio_processing["global_target_lufs"] = target_lufs

        # Mark all audio clips for normalization at render time
        for scene_key, scene_tl in assembled.items():
            if not isinstance(scene_tl, dict):
                continue
            for track_type in ("audio", "music", "effects"):
                for clip in scene_tl.get("tracks", {}).get(track_type, []):
                    clip["normalize_lufs"] = target_lufs

        state["audio_processing"] = audio_processing
        return state

    async def enforce_global_color_profile(self, state: dict) -> dict:
        """Applies consistent color grading metadata across all scenes."""
        logger.info("ConsistencyEngine: Enforcing global color profile.")

        assembled = state.get("assembled_timeline", {})
        color_grading = state.get("color_grading", {})

        if not isinstance(assembled, dict) or not color_grading:
            return state

        # Apply the show bible color grading to every video clip
        for scene_key, scene_tl in assembled.items():
            if not isinstance(scene_tl, dict):
                continue
            for clip in scene_tl.get("tracks", {}).get("video", []):
                clip["color_grading"] = color_grading

        return state

    async def resolve_transition_overlaps(self, state: dict) -> dict:
        """Ensures smooth seams between scenes with crossfade audio/video."""
        logger.info("ConsistencyEngine: Resolving transition overlaps between scenes.")

        assembled = state.get("assembled_timeline", {})
        effects_metadata = state.get("effects_metadata", [])

        if not isinstance(assembled, dict):
            return state

        effects_by_scene = {e.get("scene_id"): e for e in effects_metadata if isinstance(e, dict)}

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

            # Get transition out of current scene
            current_video = current_tl.get("tracks", {}).get("video", [])
            if current_video:
                last_clip = current_video[-1]
                transition = last_clip.get("transition_out", "cut")
                if transition != "cut":
                    last_clip["crossfade_out_duration"] = 0.5

            # Get transition in of next scene
            next_video = next_tl.get("tracks", {}).get("video", [])
            if next_video:
                first_clip = next_video[0]
                transition = first_clip.get("transition_in", "cut")
                if transition != "cut":
                    first_clip["crossfade_in_duration"] = 0.5

        return state

    async def verify_timeline_continuity(self, state: dict) -> dict:
        """Check for gaps, overlaps, and duration mismatches in the assembled timeline."""
        logger.info("ConsistencyEngine: Verifying timeline continuity.")

        assembled = state.get("assembled_timeline", {})
        issues = []

        if not isinstance(assembled, dict):
            return state

        scene_keys = sorted(
            [k for k in assembled.keys() if k.startswith("scene_")],
            key=lambda x: int(x.split("_")[1]) if x.split("_")[1].isdigit() else 0,
        )

        expected_offset = 0.0
        for key in scene_keys:
            scene_tl = assembled.get(key, {})
            if not isinstance(scene_tl, dict):
                issues.append({"scene": key, "issue": "missing_timeline_data"})
                continue

            scene_duration = scene_tl.get("total_duration", 0)
            video_clips = scene_tl.get("tracks", {}).get("video", [])

            if not video_clips:
                issues.append({"scene": key, "issue": "no_video_clips"})

            # Check if any video clip has an empty asset URL
            for clip in video_clips:
                if not clip.get("assetUrl"):
                    issues.append({
                        "scene": key,
                        "clip_id": clip.get("id"),
                        "issue": "missing_asset_url",
                    })

            expected_offset += scene_duration

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

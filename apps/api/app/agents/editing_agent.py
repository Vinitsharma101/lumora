"""
Editing Agent — Professional timeline assembly engine.

Takes generated assets, the scene plan, and the style profile to build
a complete multi-track timeline following professional editing standards:

Track architecture:
  V3 – Graphics / Effects (text overlays, motion graphics)
  V2 – B-roll / Overlay (supplementary visuals)
  V1 – Main Footage (primary video/image clips)
  A3 – Music (background score)
  A2 – SFX (sound effects, whooshes, impacts)
  A1 – Dialogue (voiceover, character dialog)

Uses style profile for:
  - Audio volume levels (ducking, compression metadata)
  - Transition types and durations
  - Motion/zoom parameters
  - Caption placement rules
"""

import logging
from app.services.text_sizing import calculate_text_overlay_props

logger = logging.getLogger(__name__)


class EditingAgent:
    """Assembles generated assets onto a multi-track timeline using professional rules."""

    async def run(self, state: dict) -> dict:
        """Build the timeline from the plan and generated assets."""
        plan = state.get("scene_plan", {})
        assets_list = state.get("generated_assets", [])
        assets = {a["scene_id"]: a for a in assets_list if isinstance(a, dict)}

        if not plan.get("scenes"):
            return {**state, "error": "No scenes in plan", "status": "failed"}

        resolution = plan.get("resolution", {"width": 1920, "height": 1080})
        canvas_width = resolution.get("width", 1920)
        canvas_height = resolution.get("height", 1080)
        total_duration = plan.get("total_duration", 30)

        # Load style profile for professional mixing decisions
        style_profile = state.get("style_profile", {})
        audio_config = style_profile.get("audio", {})
        pacing_config = style_profile.get("pacing", {})
        motion_config = style_profile.get("motion", {})

        # Audio processing metadata from AudioAgent
        audio_processing = state.get("audio_processing", {})
        effects_metadata_list = state.get("effects_metadata", [])
        effects_by_scene = {e["scene_id"]: e for e in effects_metadata_list if isinstance(e, dict)}

        # Profile-driven volume levels
        vol_dialog = audio_config.get("volume_dialog", audio_processing.get("volume_dialog", 1.0))
        vol_music = audio_config.get("volume_music", audio_processing.get("volume_music", 0.3))
        vol_sfx = audio_config.get("volume_sfx", audio_processing.get("volume_sfx", 0.7))
        vol_ambient = audio_config.get("volume_ambient", audio_processing.get("volume_ambient", 0.4))
        music_fade_in = audio_config.get("music_fade_in_sec", audio_processing.get("music_fade_in_sec", 2.0))
        music_fade_out = audio_config.get("music_fade_out_sec", audio_processing.get("music_fade_out_sec", 3.0))

        timeline = {
            "total_duration": total_duration,
            "fps": style_profile.get("target_fps", 24),
            "resolution": resolution,
            "content_type": state.get("content_type", "youtube"),
            "tracks": {
                "video":   [],  # V1 — main footage
                "overlay": [],  # V2 — B-roll
                "audio":   [],  # A1 — dialog / voiceover
                "music":   [],  # A3 — background music
                "text":    [],  # V3 — text overlays
                "effects": [],  # A2 — SFX
                "captions": [], # V3 — caption track
            },
            "audio_mix": {
                "ducking": {
                    "enabled": True,
                    "duck_depth_db": audio_processing.get("music_duck_db", -8.0),
                    "duck_attack_ms": audio_processing.get("duck_attack_ms", 50.0),
                    "duck_release_ms": audio_processing.get("duck_release_ms", 300.0),
                    "duck_hold_ms": audio_processing.get("duck_hold_ms", 200.0),
                    "trigger": "dialog_presence",
                },
                "target_lufs": {
                    "dialog": audio_processing.get("target_lufs", -16.0),
                    "music_active": audio_processing.get("music_under_speech_lufs", -24.0),
                    "music_passive": audio_processing.get("music_no_speech_lufs", -14.0),
                    "sfx": audio_processing.get("sfx_lufs", -18.0),
                    "ambient": audio_processing.get("ambient_lufs", -28.0),
                },
            },
        }

        cursor = 0.0

        for scene in plan["scenes"]:
            scene_id = scene["scene_id"]
            dur = scene.get("duration", 5)
            asset = assets.get(scene_id, {})
            scene_effects = effects_by_scene.get(scene_id, {})

            # ── V1: Main video track ────────────────────────────────────
            video_url = asset.get("video_url") or asset.get("image_url") or ""
            clip_type = "video" if asset.get("video_url") else "image"

            video_clip = {
                "id": f"clip_{scene_id}",
                "type": clip_type,
                "assetUrl": video_url,
                "startTime": cursor,
                "duration": dur,
                "trimStart": 0,
                "trimEnd": 0,
                "transition_in": scene.get("transition_in", "cut"),
                "transition_out": scene.get("transition_out", "cut"),
                "transition_in_duration": _get_transition_duration(scene.get("transition_in", "cut")),
                "transition_out_duration": _get_transition_duration(scene.get("transition_out", "cut")),
                "camera": scene.get("camera", {}),
                "lighting": scene.get("lighting", {}),
            }

            # Attach motion metadata from EffectsAgent
            if scene_effects.get("ken_burns"):
                video_clip["ken_burns"] = scene_effects["ken_burns"]
            if scene_effects.get("drift"):
                video_clip["drift"] = scene_effects["drift"]
            if scene_effects.get("speed_ramp"):
                video_clip["speed_ramp"] = scene_effects["speed_ramp"]
            if scene_effects.get("punch_zooms"):
                video_clip["punch_zooms"] = scene_effects["punch_zooms"]

            timeline["tracks"]["video"].append(video_clip)

            # ── A1: Voiceover / dialog track ────────────────────────────
            voiceover = scene.get("voiceover")
            audio_url = asset.get("normalized_audio_url") or asset.get("audio_url")
            if voiceover and voiceover.get("text"):
                timeline["tracks"]["audio"].append({
                    "id": f"vo_{scene_id}",
                    "type": "voiceover",
                    "assetUrl": audio_url or "",
                    "text": voiceover["text"],
                    "startTime": cursor,
                    "duration": dur,
                    "volume": vol_dialog,
                    "voice_style": voiceover.get("voice_style", "narrator"),
                    "ducking_trigger": True,  # this track triggers music ducking
                })

            # ── A1: Ambient / mixed audio ───────────────────────────────
            scene_audio = scene.get("audio")
            if scene_audio and scene_audio.get("type") in ("music", "ambient", "sfx"):
                ambient_url = state.get("mixed_audio_url") or ""
                timeline["tracks"]["audio"].append({
                    "id": f"audio_{scene_id}",
                    "type": scene_audio["type"],
                    "assetUrl": ambient_url,
                    "description": scene_audio.get("description", ""),
                    "startTime": cursor,
                    "duration": dur,
                    "volume": vol_ambient if scene_audio["type"] == "ambient" else scene_audio.get("volume", 0.5),
                })

            # ── V3: Text overlays (responsive sizing) ──────────────────
            for idx, overlay in enumerate(scene.get("text_overlays", [])):
                sized_overlay = calculate_text_overlay_props(
                    canvas_width, canvas_height, overlay,
                )
                timeline["tracks"]["text"].append({
                    "id": f"text_{scene_id}_{idx}",
                    "startTime": cursor + overlay.get("start_offset", 0),
                    "duration": overlay.get("duration", 3),
                    "content": overlay["content"],
                    "font": overlay.get("font", "Inter"),
                    "fontSize": sized_overlay["fontSize"],
                    "color": overlay.get("color", "#FFFFFF"),
                    "position": overlay.get("position", "center"),
                    "animation": overlay.get("animation", "fade_in"),
                    "fontWeight": overlay.get("fontWeight", "bold"),
                    "paddingX": sized_overlay.get("paddingX"),
                    "paddingY": sized_overlay.get("paddingY"),
                    "maxWidth": sized_overlay.get("maxWidth"),
                    "lineHeight": sized_overlay.get("lineHeight"),
                })

            cursor += dur

        # ── A3: Background music (full timeline span) ──────────────────
        music_url = state.get("music_url")
        music_track = plan.get("music_track")
        if music_track:
            timeline["tracks"]["music"].append({
                "id": "bg_music",
                "type": "music",
                "assetUrl": music_url or "",
                "description": music_track.get("description", "Background music"),
                "startTime": 0,
                "duration": total_duration,
                "volume": vol_music,
                "bpm": music_track.get("bpm"),
                "mood": music_track.get("mood"),
                "fade_in_sec": music_fade_in,
                "fade_out_sec": music_fade_out,
                "ducking_target": True,  # this track gets ducked by dialog
            })

        # ── A2: Sound effects ──────────────────────────────────────────
        sfx_generated = state.get("sound_effects_generated", [])
        sfx_by_scene = {s.get("scene_id"): s for s in sfx_generated if isinstance(s, dict)}

        for sfx in plan.get("sound_effects", []):
            scene_start = 0.0
            for s in plan["scenes"]:
                if s["scene_id"] == sfx.get("scene_id"):
                    break
                scene_start += s.get("duration", 5)

            generated_sfx = sfx_by_scene.get(sfx.get("scene_id"), {})

            timeline["tracks"]["effects"].append({
                "id": f"sfx_{sfx.get('scene_id', 'x')}_{sfx.get('description', '')[:10]}",
                "type": "sfx",
                "assetUrl": generated_sfx.get("audio_url", ""),
                "description": sfx.get("description", ""),
                "startTime": scene_start + sfx.get("start_offset", 0),
                "duration": sfx.get("duration", 1),
                "volume": vol_sfx,
                "fade_in_sec": audio_config.get("sfx_fade_in_sec", 0.05),
                "fade_out_sec": audio_config.get("sfx_fade_out_sec", 0.15),
            })

        # Recalculate total duration from actual clip layout
        if timeline["tracks"]["video"]:
            last_clip = timeline["tracks"]["video"][-1]
            timeline["total_duration"] = last_clip["startTime"] + last_clip["duration"]

        return {
            **state,
            "assembled_timeline": timeline,
            "status": "reviewing",
            "messages": state.get("messages", []) + [
                {"role": "agent", "content": (
                    f"Timeline assembled: {len(timeline['tracks']['video'])} video clips, "
                    f"{len(timeline['tracks']['text'])} text overlays, "
                    f"{len(timeline['tracks']['audio'])} audio clips, "
                    f"{len(timeline['tracks']['effects'])} SFX. "
                    f"Content type: {timeline.get('content_type', 'unknown')}."
                )}
            ]
        }


def _get_transition_duration(transition_type: str) -> float:
    """Get transition duration in seconds."""
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

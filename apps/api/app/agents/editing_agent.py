"""
Editing Agent — Takes generated assets and the scene plan, then assembles
a complete multi-track timeline with precise start/end times, transitions,
text overlays, and audio layering.

Uses actual asset URLs from the GenerationAgent (stored in Supabase).
"""

import logging

logger = logging.getLogger(__name__)


class EditingAgent:
    """Assembles generated assets onto a multi-track timeline."""

    async def run(self, state: dict) -> dict:
        """Build the timeline from the plan and generated assets."""
        plan = state.get("scene_plan", {})
        assets_list = state.get("generated_assets", [])
        assets = {a["scene_id"]: a for a in assets_list if isinstance(a, dict)}

        if not plan.get("scenes"):
            return {**state, "error": "No scenes in plan", "status": "failed"}

        resolution = plan.get("resolution", {"width": 1920, "height": 1080})
        total_duration = plan.get("total_duration", 30)

        timeline = {
            "total_duration": total_duration,
            "fps": 24,
            "resolution": resolution,
            "tracks": {
                "video":   [],
                "overlay": [],
                "audio":   [],
                "music":   [],
                "text":    [],
                "effects": [],
            }
        }

        cursor = 0.0

        for scene in plan["scenes"]:
            scene_id = scene["scene_id"]
            dur = scene.get("duration", 5)
            asset = assets.get(scene_id, {})

            # ── Video track ─────────────────────────────────────────────
            video_url = asset.get("video_url") or asset.get("image_url") or ""
            clip_type = "video" if asset.get("video_url") else "image"

            timeline["tracks"]["video"].append({
                "id": f"clip_{scene_id}",
                "type": clip_type,
                "assetUrl": video_url,
                "startTime": cursor,
                "duration": dur,
                "trimStart": 0,
                "trimEnd": 0,
                "transition_in": scene.get("transition_in", "cut"),
                "transition_out": scene.get("transition_out", "cut"),
                "camera": scene.get("camera", {}),
                "lighting": scene.get("lighting", {}),
            })

            # ── Voiceover / audio track ─────────────────────────────────
            voiceover = scene.get("voiceover")
            audio_url = asset.get("audio_url")
            if voiceover and voiceover.get("text"):
                audio_spec = scene.get("audio", {})
                timeline["tracks"]["audio"].append({
                    "id": f"vo_{scene_id}",
                    "type": "voiceover",
                    "assetUrl": audio_url or "",
                    "text": voiceover["text"],
                    "startTime": cursor,
                    "duration": dur,
                    "volume": audio_spec.get("volume", 1.0),
                    "voice_style": voiceover.get("voice_style", "narrator"),
                })

            # ── Ambient audio track ─────────────────────────────────────
            scene_audio = scene.get("audio")
            if scene_audio and scene_audio.get("type") in ("music", "ambient", "sfx"):
                timeline["tracks"]["audio"].append({
                    "id": f"audio_{scene_id}",
                    "type": scene_audio["type"],
                    "description": scene_audio.get("description", ""),
                    "startTime": cursor,
                    "duration": dur,
                    "volume": scene_audio.get("volume", 0.5),
                })

            # ── Text overlays track ─────────────────────────────────────
            for idx, overlay in enumerate(scene.get("text_overlays", [])):
                timeline["tracks"]["text"].append({
                    "id": f"text_{scene_id}_{idx}",
                    "startTime": cursor + overlay.get("start_offset", 0),
                    "duration": overlay.get("duration", 3),
                    "content": overlay["content"],
                    "font": overlay.get("font", "Inter"),
                    "fontSize": overlay.get("size", 48),
                    "color": overlay.get("color", "#FFFFFF"),
                    "position": overlay.get("position", "center"),
                    "animation": overlay.get("animation", "fade_in"),
                    "fontWeight": overlay.get("fontWeight", "bold"),
                })

            cursor += dur

        # ── Background music ────────────────────────────────────────────
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
                "volume": music_track.get("volume", 0.3),
                "bpm": music_track.get("bpm"),
                "mood": music_track.get("mood"),
            })

        # ── Sound effects ───────────────────────────────────────────────
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
            })

        return {
            **state,
            "assembled_timeline": timeline,
            "status": "reviewing",
            "messages": state.get("messages", []) + [
                {"role": "agent", "content": f"Timeline assembled: {len(timeline['tracks']['video'])} video clips, {len(timeline['tracks']['text'])} text overlays, {len(timeline['tracks']['audio'])} audio clips"}
            ]
        }

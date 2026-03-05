"""
Planning Agent — Takes the user's query + answered Q&A and produces a
detailed scene-by-scene production plan with camera angles, lighting,
character specs, text overlays, audio, and transitions.
Uses the Anthropic API directly.
"""

import json
import logging
from anthropic import AsyncAnthropic
from app.config import settings

logger = logging.getLogger(__name__)

PLANNING_SYSTEM_PROMPT = """You are an expert film director and video editor AI.
Given a user's creative brief and answered Q&A, produce a detailed production plan.

Output ONLY valid JSON with this structure:
{
  "title": "Project title",
  "total_duration": 30,
  "aspect_ratio": "16:9",
  "resolution": {"width": 1920, "height": 1080},
  "style": "cinematic",
  "color_palette": ["#1a1a2e", "#16213e", "#0f3460", "#e94560"],
  "scenes": [
    {
      "scene_id": "s1",
      "description": "Opening aerial shot of city at dusk",
      "duration": 5,
      "visual_type": "text_to_video",
      "prompt": "Detailed generation prompt for this scene with visual specifics",
      "camera": {
        "angle": "aerial",
        "movement": "slow_dolly_forward",
        "framing": "extreme_wide_shot"
      },
      "lighting": {
        "type": "golden_hour",
        "mood": "warm",
        "direction": "backlit"
      },
      "character_ids": [],
      "audio": {
        "type": "music",
        "description": "Ambient electronic pad, building tension",
        "volume": 0.7
      },
      "voiceover": {
        "text": "In a world where technology meets creativity...",
        "voice_style": "deep_narrator",
        "pace": "slow"
      },
      "text_overlays": [
        {
          "content": "THE FUTURE IS NOW",
          "font": "Montserrat",
          "size": 64,
          "color": "#FFFFFF",
          "position": "center",
          "animation": "fade_up",
          "start_offset": 1.5,
          "duration": 3
        }
      ],
      "transition_in": "fade",
      "transition_out": "dissolve"
    }
  ],
  "characters": [
    {
      "char_id": "char_1",
      "name": "Alex",
      "description": "Young professional in their 30s, modern clothing, confident",
      "reference_image_url": null,
      "consistency_seed": 42
    }
  ],
  "music_track": {
    "description": "Upbeat electronic background music",
    "bpm": 120,
    "mood": "energetic",
    "volume": 0.3
  },
  "sound_effects": [
    {
      "scene_id": "s1",
      "description": "Whoosh transition",
      "start_offset": 4.5,
      "duration": 0.5
    }
  ]
}

Camera angle options:
- wide_shot, medium_shot, close_up, extreme_close_up
- aerial, birds_eye, low_angle, high_angle, dutch_angle
- over_the_shoulder, point_of_view, tracking

Camera movement options:
- static, pan_left, pan_right, tilt_up, tilt_down
- dolly_in, dolly_out, truck_left, truck_right
- crane_up, crane_down, handheld, steadicam
- slow_zoom_in, slow_zoom_out, orbit

Lighting options:
- natural, golden_hour, blue_hour, overcast
- studio, dramatic_side, rim_light, silhouette
- neon, noir, high_key, low_key, chiaroscuro

Transition options: cut, fade, dissolve, wipe, slide, zoom, glitch

IMPORTANT: The prompt for each scene must be extremely detailed, describing
exactly what should appear, the visual style, colors, and mood. Include
camera angle and lighting details directly in the prompt text.
"""


class PlanningAgent:
    """Produces a detailed scene-by-scene plan for autonomous video creation."""

    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def run(self, state: dict) -> dict:
        """Generate the production plan from the query + Q&A answers."""
        response = await self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=8192,
            system=PLANNING_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": f"""Create a production plan for ONE scene:

Scene Objective: {state.get('current_scene', state.get('original_query', ''))}

Show Bible / Global Rules:
{json.dumps(state.get('show_bible', {}), indent=2)}

Available Media Assets:
{json.dumps(state.get('clarified_context', {}).get('media_assets', []), indent=2)}

Create a detailed production plan for this specific scene with camera angles,
lighting, text overlays, voiceovers, and sound effects.
Duration should match the estimated_duration_seconds from the scene objective or default to 15s.
"""
            }]
        )

        try:
            text = response.content[0].text
            if "```" in text:
                text = text.split("```json")[-1].split("```")[0] if "```json" in text else text.split("```")[1].split("```")[0]
            plan = json.loads(text.strip())
        except (json.JSONDecodeError, IndexError) as e:
            logger.error(f"Planning Agent failed to parse plan: {e}")
            return {
                **state,
                "scene_plan": {},
                "error": f"Planning failed: could not parse scene plan",
                "status": "failed"
            }

        characters = {c["char_id"]: c for c in plan.get("characters", [])}

        return {
            **state,
            "scene_plan": plan,
            "character_profiles": characters,
            "status": "generating",
            "messages": state.get("messages", []) + [
                {"role": "agent", "content": f"Plan created: {plan.get('title', 'Untitled')} — {len(plan.get('scenes', []))} scenes, {plan.get('total_duration', 0)}s total"}
            ]
        }

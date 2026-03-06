"""
Planning Agent — Takes a scene from the Director's plan and produces a
detailed production plan with multiple shots, camera angles, lighting,
character specs, text overlays, audio, and transitions.

Each shot becomes a separate generation unit for the GenerationAgent.
"""

import json
import logging
from anthropic import AsyncAnthropic
from app.config import settings

logger = logging.getLogger(__name__)

PLANNING_SYSTEM_PROMPT = """You are an expert film director and video editor AI.
Given a scene from a movie's screenplay, produce a detailed production plan
where each shot is a separate generation unit.

Output ONLY valid JSON with this structure:
{
  "title": "Scene title",
  "total_duration": 15,
  "aspect_ratio": "16:9",
  "resolution": {"width": 1920, "height": 1080},
  "style": "cinematic",
  "color_palette": ["#1a1a2e", "#16213e", "#0f3460", "#e94560"],
  "scenes": [
    {
      "scene_id": "s1_shot1",
      "description": "Establishing wide shot of the location",
      "duration": 5,
      "visual_type": "text_to_video",
      "prompt": "Extremely detailed generation prompt describing exactly what should appear, the visual style, colors, mood, camera angle, and lighting",
      "camera": {
        "angle": "wide_shot",
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
        "type": "ambient",
        "description": "City sounds, distant traffic",
        "volume": 0.4
      },
      "voiceover": null,
      "text_overlays": [],
      "transition_in": "fade",
      "transition_out": "dissolve"
    },
    {
      "scene_id": "s1_shot2",
      "description": "Dialog shot - character speaking",
      "duration": 4,
      "visual_type": "text_to_video",
      "prompt": "Medium shot of character speaking, detailed visual description...",
      "camera": {"angle": "medium_shot", "movement": "static", "framing": "medium"},
      "lighting": {"type": "natural", "mood": "neutral", "direction": "front"},
      "character_ids": ["char_1"],
      "voiceover": {
        "text": "The actual dialog line",
        "voice_style": "conversational",
        "speaker": "char_1",
        "emotion": "neutral",
        "pace": "normal"
      },
      "text_overlays": [],
      "transition_in": "cut",
      "transition_out": "cut"
    }
  ],
  "characters": [
    {
      "char_id": "char_1",
      "name": "Alex",
      "description": "Detailed visual description for this scene",
      "reference_image_url": null,
      "consistency_seed": 42,
      "style_suffix": "consistent appearance keywords"
    }
  ],
  "music_track": {
    "description": "Scene-appropriate music description",
    "bpm": 90,
    "mood": "contemplative",
    "volume": 0.2
  },
  "sound_effects": [
    {
      "scene_id": "s1_shot1",
      "description": "Door opening creak",
      "start_offset": 2.0,
      "duration": 0.5
    }
  ]
}

SHOT PLANNING RULES:
- Each scene from the screenplay should have 2-5 shots
- Dialog scenes MUST have shot/reverse-shot pattern (speaker + reaction)
- Include establishing shots for new locations
- Insert shots and close-ups for emotional emphasis
- Each shot prompt must be extremely detailed for AI video generation
- Shots within the same scene share location/lighting/characters for coherence
- Duration of all shots should sum to the scene's estimated_duration_seconds
- For dialog: create one shot per line, with the speaker as character_focus
- Voiceover text must contain ONLY the spoken words, not stage directions

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
"""


class PlanningAgent:
    """Produces a detailed multi-shot plan for a single scene."""

    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def run(self, state: dict) -> dict:
        """Generate the production plan from the scene + show bible."""
        current_scene = state.get("current_scene", {})
        show_bible = state.get("show_bible", {})

        # Build context about dialog and shots from director
        scene_context = json.dumps(current_scene, indent=2) if isinstance(current_scene, dict) else str(current_scene)

        response = await self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8192,
            system=PLANNING_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": f"""Create a multi-shot production plan for this scene:

Scene Data:
{scene_context}

Show Bible / Global Rules:
{json.dumps(show_bible, indent=2)}

Character Profiles:
{json.dumps(state.get('character_profiles', {}), indent=2)}

Duration should match the estimated_duration_seconds from the scene or default to 15s.
Break this scene into 2-5 shots with detailed generation prompts.
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
                "error": "Planning failed: could not parse scene plan",
                "status": "failed"
            }

        characters = {c["char_id"]: c for c in plan.get("characters", [])}

        # Merge character data from show bible into plan characters
        for char_id, profile in state.get("character_profiles", {}).items():
            if char_id not in characters:
                characters[char_id] = profile
            else:
                # Enrich plan characters with show bible data
                for key in ("description", "voice_description", "arc", "voice_assignment"):
                    if profile.get(key) and not characters[char_id].get(key):
                        characters[char_id][key] = profile[key]

        return {
            **state,
            "scene_plan": plan,
            "character_profiles": characters,
            "status": "generating",
            "messages": state.get("messages", []) + [
                {"role": "agent", "content": f"Plan created: {plan.get('title', 'Untitled')} - {len(plan.get('scenes', []))} shots, {plan.get('total_duration', 0)}s total"}
            ]
        }

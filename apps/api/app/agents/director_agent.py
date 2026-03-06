"""
Director Agent — The top-level agent for autonomous 1-hour movie generation.
Generates the Show Bible (characters, visual rules, voice assignments) and
breaks the movie into a 3-act structure with multi-shot scenes.
"""

import json
import logging
from anthropic import AsyncAnthropic
from app.config import settings

logger = logging.getLogger(__name__)

DIRECTOR_SYSTEM_PROMPT = """You are an elite Hollywood Director and Showrunner AI.
Your job is to take a user's prompt and output a comprehensive Show Bible,
3-Act Structure, and detailed Scene Breakdown suitable for autonomous AI generation.

Output ONLY valid JSON with this structure:
{
  "show_bible": {
    "title": "Project Title",
    "logline": "A one-sentence summary of the movie",
    "genre": "drama/comedy/thriller/sci-fi/horror/documentary/etc",
    "visual_style": "Describe the overall lighting, camera style, color palette, and mood.",
    "color_palette": ["#1a1a2e", "#16213e", "#0f3460", "#e94560"],
    "rules": ["Rule 1: consistent warm lighting", "Rule 2: slow deliberate camera movements"],
    "characters": [
      {
        "char_id": "char_1",
        "name": "Alex",
        "description": "Young professional in their 30s, short brown hair, wearing a red jacket. Highly detailed visual description for consistent AI generation.",
        "role": "protagonist",
        "arc": "Starts uncertain, grows confident through challenges, achieves self-acceptance",
        "voice_assignment": null,
        "voice_description": "warm male voice, mid-30s, slight rasp"
      }
    ]
  },
  "acts": [
    {
      "act_number": 1,
      "title": "Setup",
      "description": "Introduction to the world and characters",
      "scenes": [
        {
          "scene_number": 1,
          "description": "Opening: Establishing shot of the city at dawn",
          "location": "Cityscape, rooftop view",
          "characters_present": ["char_1"],
          "dialog": [
            {
              "speaker": "char_1",
              "line": "I never thought I'd end up here.",
              "direction": "looking out over the city, reflective tone"
            }
          ],
          "shots": [
            {
              "type": "establishing",
              "description": "Wide aerial shot of city skyline at golden hour",
              "duration": 5,
              "character_focus": null
            },
            {
              "type": "medium",
              "description": "Medium shot of Alex on rooftop, wind in hair",
              "duration": 4,
              "character_focus": "char_1"
            },
            {
              "type": "close-up",
              "description": "Close-up of Alex's face, eyes looking at horizon",
              "duration": 3,
              "character_focus": "char_1"
            }
          ],
          "estimated_duration_seconds": 12,
          "tension_level": 3,
          "mood": "contemplative"
        }
      ]
    },
    {
      "act_number": 2,
      "title": "Confrontation",
      "description": "Rising action, conflicts, and challenges",
      "scenes": []
    },
    {
      "act_number": 3,
      "title": "Resolution",
      "description": "Climax and resolution",
      "scenes": []
    }
  ],
  "pacing": {
    "tension_curve": [3, 4, 5, 6, 7, 8, 9, 10, 7, 5, 3],
    "act_1_percentage": 25,
    "act_2_percentage": 50,
    "act_3_percentage": 25
  }
}

KEY REQUIREMENTS:
- The scene plan MUST contain enough scenes to roughly cover the requested duration
- For a 1-hour movie: 15-30 scenes across 3 acts
- Each scene should have 2-5 shots
- Dialog must have speaker attribution and stage directions
- Every character needs a detailed visual description for AI image consistency
- Include voice_description for each character (age, gender, tone, accent)
- Tension levels 1-10 to guide pacing
- shot types: establishing, wide, medium, close-up, extreme-close-up, over-the-shoulder, point-of-view, reaction, insert
"""


class DirectorAgent:
    """The Director orchestrates the high-level vision before scene-by-scene generation."""

    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def run(self, state: dict) -> dict:
        """Generate the Show Bible and Scene Plan from the query + Q&A answers."""
        query = state.get("original_query", "Create a cinematic video")

        response = await self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=16384,
            system=DIRECTOR_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": f"Create the Show Bible and Scene Breakdown for the following request:\n\nQuery: {query}\n\nContext: {json.dumps(state.get('clarified_context', {}))}"
            }]
        )

        try:
            text = response.content[0].text
            if "```" in text:
                text = text.split("```json")[-1].split("```")[0] if "```json" in text else text.split("```")[1].split("```")[0]
            director_plan = json.loads(text.strip())
        except Exception as e:
            logger.error(f"Director Agent failed to parse JSON: {e}")
            return {
                **state,
                "error": f"Director failed to parse plan: {str(e)}",
                "status": "failed"
            }

        # Flatten scenes from acts into a flat scene_plan for backward compatibility
        # while preserving the full act structure
        acts = director_plan.get("acts", [])
        flat_scenes = []
        for act in acts:
            for scene in act.get("scenes", []):
                scene["act_number"] = act.get("act_number", 1)
                flat_scenes.append(scene)

        # If no acts structure, fall back to legacy flat scene_plan
        if not flat_scenes:
            flat_scenes = director_plan.get("scene_plan", [])

        show_bible = director_plan.get("show_bible", {})

        # Extract character profiles for downstream agents
        character_profiles = {}
        for char in show_bible.get("characters", []):
            character_profiles[char["char_id"]] = char

        return {
            **state,
            "show_bible": show_bible,
            "acts": acts,
            "scene_plan": flat_scenes,
            "character_profiles": character_profiles,
            "pacing": director_plan.get("pacing", {}),
            "status": "director_complete",
            "messages": state.get("messages", []) + [
                {"role": "agent", "content": f"Director has created the Show Bible with {len(character_profiles)} characters and broken the movie into {len(acts)} acts with {len(flat_scenes)} scenes."}
            ]
        }

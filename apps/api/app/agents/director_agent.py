"""
Director Agent — The top-level agent for autonomous 1-hour movie generation.
Generates the Show Bible (characters, visual rules) and breaks the movie into individual scenes.
"""

import json
import logging
from anthropic import AsyncAnthropic
from app.config import settings

logger = logging.getLogger(__name__)

DIRECTOR_SYSTEM_PROMPT = """You are an elite Hollywood Director and Showrunner AI.
Your job is to take a user's prompt (which may ask for a 1-hour movie or long-form video) 
and output a comprehensive Show Bible and Scene Breakdown.

Output ONLY valid JSON with this structure:
{
  "show_bible": {
    "title": "Project Title",
    "logline": "A one-sentence summary of the movie",
    "visual_style": "Describe the overall lighting, camera style, color palette, and mood.",
    "rules": ["Rule 1: No fast cuts", "Rule 2: Always use warm lighting"],
    "characters": [
      {
        "char_id": "char_1",
        "name": "Alex",
        "description": "Young professional, wearing a red jacket. Highly detailed visual description for consistent generation."
      }
    ]
  },
  "scene_plan": [
    {
      "scene_number": 1,
      "description": "Opening act: Introduction to the world.",
      "estimated_duration_seconds": 120
    },
    {
      "scene_number": 2,
      "description": "The inciting incident.",
      "estimated_duration_seconds": 300
    }
  ]
}

Ensure the scene plan contains enough scenes to roughly cover the requested duration.
If the user asks for a 1-hour movie, break it down into 10-30 logical scenes (chunks) 
that can be processed individually by downstream agents.
"""


class DirectorAgent:
    """The Director orchestrates the high-level vision before scene-by-scene generation."""

    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def run(self, state: dict) -> dict:
        """Generate the Show Bible and Scene Plan from the query + Q&A answers."""
        query = state.get("original_query", "Create a cinematic video")
        
        response = await self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=8192,
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

        return {
            **state,
            "show_bible": director_plan.get("show_bible", {}),
            "scene_plan": director_plan.get("scene_plan", []),
            "status": "director_complete",
            "messages": state.get("messages", []) + [
                {"role": "agent", "content": f"Director has created the Show Bible and broken the movie into {len(director_plan.get('scene_plan', []))} scenes."}
            ]
        }

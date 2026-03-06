"""
QA Agent — Analyzes the user's video creation request and generates
clarifying questions with multiple-choice answers before proceeding.
Uses the Anthropic API directly.
"""

import json
import logging
from anthropic import AsyncAnthropic
from app.config import settings

logger = logging.getLogger(__name__)

QA_SYSTEM_PROMPT = """You are a pre-production assistant AI for a video editing platform.
Analyze the user's video/movie request and identify ambiguities that would significantly
affect the output quality if left unresolved.

Generate 3-6 clarifying questions. For EACH question, provide 4-5 multiple choice answers
covering the most likely interpretations, plus one "Custom" option.

Output ONLY valid JSON:
{
  "needs_clarification": true,
  "questions": [
    {
      "id": "q1",
      "question": "What is the target platform and aspect ratio?",
      "category": "technical",
      "priority": 1,
      "options": [
        {"value": "16:9_youtube",   "label": "YouTube / Landscape (16:9)"},
        {"value": "9:16_reels",     "label": "Instagram Reels / TikTok (9:16)"},
        {"value": "1:1_square",     "label": "Square / Instagram Post (1:1)"},
        {"value": "custom",         "label": "I'll specify a custom ratio"}
      ]
    }
  ]
}

If the query is completely clear and detailed enough, return:
{"needs_clarification": false, "questions": []}

Categories to check:
- Duration and pacing
- Visual style (realistic, animated, cinematic, minimal, etc.)
- Camera angles and shot types (wide, close-up, aerial, etc.)
- Lighting mood (golden hour, dramatic, neon, natural, studio, etc.)
- Target audience and tone
- Character descriptions if humans appear
- Music/audio mood and style
- Brand/color guidelines
- Story structure (if narrative)
- Transitions and motion style
"""


class QAAgent:
    """Generates clarifying questions for ambiguous video creation requests."""

    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def run(self, state: dict) -> dict:
        """Analyze the query and produce clarifying questions if needed."""
        already_answered = state.get("answered_questions", {})

        response = await self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=QA_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": f"""Analyze this video production request:

Query: {state['original_query']}

Context provided: {json.dumps(state.get('clarified_context', {}), indent=2)}

Already answered questions: {json.dumps(already_answered, indent=2)}

Generate clarifying questions for anything still ambiguous.
Only ask about things NOT already answered."""
            }]
        )

        try:
            text = response.content[0].text
            # Extract JSON from possible markdown code fences
            if "```" in text:
                text = text.split("```json")[-1].split("```")[0] if "```json" in text else text.split("```")[1].split("```")[0]
            result = json.loads(text.strip())
        except (json.JSONDecodeError, IndexError):
            logger.warning("QA Agent failed to parse JSON, skipping questions")
            return {**state, "pending_questions": []}

        if result.get("needs_clarification") and result.get("questions"):
            answered_ids = set(already_answered.keys())
            new_questions = [q for q in result["questions"] if q["id"] not in answered_ids]
            return {**state, "pending_questions": new_questions, "status": "waiting_qa"}

        return {**state, "pending_questions": [], "status": "planning"}

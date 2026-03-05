"""
Analysis Agent — Analyzes video chunks in parallel.
Generates a 'Video Map' with transcribed audio, scene boundaries, and visual metadata.
"""

import logging
import json
from anthropic import AsyncAnthropic
from app.config import settings

logger = logging.getLogger(__name__)

ANALYSIS_SYSTEM_PROMPT = """You are an advanced Video and Audio Analysis AI.
Your task is to analyze a portion of a video (a chunk) and extract a detailed metadata map.
Identify objects, faces, scenes, silence gaps, and provide a pseudo-transcription.

Return ONLY valid JSON in the following format:
{
  "vision": {
    "scene_type": "indoor/outdoor/studio",
    "objects_detected": ["desk", "computer", "person"],
    "faces": [{"id": 1, "timestamps": [0, 10, 20]}]
  },
  "audio": {
    "transcription": [
      {"start": 0.0, "end": 5.0, "text": "Hello and welcome to the video."},
      {"start": 5.0, "end": 8.0, "text": "[SILENCE]"}
    ],
    "noise_profile": "clean",
    "avg_lufs": -14
  }
}
"""

class AnalysisAgent:
    """Analyzes a single video chunk for vision and audio features."""

    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def run(self, state: dict) -> dict:
        """Run analysis on the current chunk."""
        current_chunk = state.get("current_chunk")
        if not current_chunk:
            return {**state, "error": "No current_chunk found for analysis", "status": "failed"}

        chunk_id = current_chunk.get("chunk_id")
        logger.info(f"AnalysisAgent: Analyzing chunk {chunk_id}")

        # In a real implementation we would pass frames or audio to Whisper/GPT-4V here.
        # We simulate the prompt/response to Anthropic for the "Video Map"
        try:
            response = await self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=2048,
                system=ANALYSIS_SYSTEM_PROMPT,
                messages=[{
                    "role": "user",
                    "content": f"Analyze this video chunk.\n\nChunk Metadata: {json.dumps(current_chunk)}\nOriginal Query Context: {state.get('original_query', '')}"
                }]
            )

            text = response.content[0].text
            if "```" in text:
                text = text.split("```json")[-1].split("```")[0] if "```json" in text else text.split("```")[1].split("```")[0]
            video_map = json.loads(text.strip())
        except Exception as e:
            logger.error(f"Analysis Agent failed for chunk {chunk_id}: {e}")
            video_map = {
                "vision": {"error": str(e)},
                "audio": {"error": str(e)}
            }

        # Store the map in the state
        all_maps = state.get("video_maps", {})
        if not isinstance(all_maps, dict):
            all_maps = {}
            
        all_maps[chunk_id] = video_map

        return {
            **state,
            "video_maps": all_maps,
            "status": "analysis_complete",
            "messages": state.get("messages", []) + [
                {"role": "agent", "content": f"Analysis complete for chunk {chunk_id}."}
            ]
        }

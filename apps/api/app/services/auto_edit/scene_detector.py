"""Scene detection using cloud-based API calls.

Uses LLM vision models to analyze keyframes and detect scene boundaries.
No local models — all processing via API.
"""

import json

import httpx

from app.config import settings


async def detect_scenes_via_api(video_url: str) -> dict:
    """Detect scenes in a video using Google Gemini Vision API.

    Sends the video to Gemini's multimodal model to identify scene boundaries,
    shot types, and content descriptions.

    Returns:
        dict with 'scenes' list, each containing start, end, description
    """
    if not settings.GOOGLE_AI_API_KEY:
        raise RuntimeError("GOOGLE_AI_API_KEY required for scene detection")

    prompt = """Analyze this video and detect all scene changes/cuts.
For each scene, provide:
- start_time: when the scene starts (seconds)
- end_time: when the scene ends (seconds)
- description: brief description of what's happening
- shot_type: type of camera shot (wide, medium, close-up, etc.)
- energy_level: low, medium, or high (how dynamic/interesting the scene is)

Return ONLY valid JSON:
{
    "scenes": [
        {
            "start_time": 0.0,
            "end_time": 3.5,
            "description": "...",
            "shot_type": "wide",
            "energy_level": "medium"
        }
    ],
    "total_scenes": 5
}"""

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": settings.GOOGLE_AI_API_KEY,
            },
            json={
                "contents": [
                    {
                        "parts": [
                            {"text": prompt},
                            {
                                "fileData": {
                                    "mimeType": "video/mp4",
                                    "fileUri": video_url,
                                }
                            },
                        ]
                    }
                ],
                "generationConfig": {
                    "responseMimeType": "application/json",
                },
            },
        )
        response.raise_for_status()
        data = response.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text)


async def detect_highlights_via_llm(
    transcript: list[dict],
    scenes: list[dict],
    video_duration: float,
    count: int = 5,
) -> list[dict]:
    """Use LLM to identify highlight moments from transcript and scene data.

    Combines transcript content + scene energy levels to find the most
    engaging segments for short-form content.

    Returns list of highlight clips with start, end, and reason.
    """
    if not (settings.ANTHROPIC_API_KEY or settings.OPENAI_API_KEY or settings.GOOGLE_AI_API_KEY):
        raise RuntimeError("At least one AI provider API key required for highlight detection")

    prompt = f"""Analyze this video content and identify the {count} most engaging/interesting moments
suitable for short-form clips (TikTok, Reels, Shorts).

Video duration: {video_duration} seconds

Transcript segments:
{json.dumps(transcript[:100], indent=2)}

Scene analysis:
{json.dumps(scenes[:50], indent=2)}

For each highlight, provide:
- start_time: when to start the clip (seconds)
- end_time: when to end the clip (seconds)
- title: catchy title for the clip
- reason: why this moment is engaging
- score: engagement score 1-10

Return ONLY valid JSON:
{{
    "highlights": [
        {{
            "start_time": 0.0,
            "end_time": 15.0,
            "title": "...",
            "reason": "...",
            "score": 8
        }}
    ]
}}"""

    # Use first available provider
    if settings.OPENAI_API_KEY:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o",
                    "response_format": {"type": "json_object"},
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            response.raise_for_status()
            data = response.json()
            text = data["choices"][0]["message"]["content"]
            return json.loads(text).get("highlights", [])

    if settings.GOOGLE_AI_API_KEY:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": settings.GOOGLE_AI_API_KEY,
                },
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"responseMimeType": "application/json"},
                },
            )
            response.raise_for_status()
            data = response.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text).get("highlights", [])

    return []

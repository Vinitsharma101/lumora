"""Scene planner using LLM to break scripts into storyboard scenes.

Uses existing AI providers (Claude/GPT/Gemini) — no local models.
"""

import json

from app.config import settings
from app.http_client import get_http_client


async def plan_scenes_from_script(
    script: str,
    style: str | None = None,
    aspect_ratio: str = "16:9",
) -> dict:
    """Use an LLM to break a script into video scenes with descriptions.

    Returns a structured storyboard with scene descriptions, durations,
    camera angles, and style keywords suitable for video generation.
    """
    system_prompt = """You are a professional video storyboard artist and director.
Given a script or description, break it down into individual video scenes.

For each scene, provide:
- scene_number: sequential number
- description: detailed visual description for AI video generation (be specific about camera angles, subjects, lighting, motion)
- duration: estimated duration in seconds (2-10 seconds per scene)
- camera_angle: e.g., "wide shot", "close-up", "medium shot", "tracking shot", "aerial", "low angle"
- mood: e.g., "dramatic", "cheerful", "mysterious", "energetic", "calm"
- style_keywords: list of visual style references

Return ONLY valid JSON in this exact format:
{
    "scenes": [
        {
            "scene_number": 1,
            "description": "...",
            "duration": 5,
            "camera_angle": "wide shot",
            "mood": "dramatic",
            "style_keywords": ["cinematic", "golden hour"]
        }
    ],
    "total_duration": 30,
    "style_guide": "Overall visual style description"
}"""

    user_prompt = f"Script: {script}"
    if style:
        user_prompt += f"\nVisual style: {style}"
    user_prompt += f"\nAspect ratio: {aspect_ratio}"

    # Try Claude first, fallback to OpenAI, then Gemini
    if settings.ANTHROPIC_API_KEY:
        return await _plan_with_claude(system_prompt, user_prompt)
    if settings.OPENAI_API_KEY:
        return await _plan_with_openai(system_prompt, user_prompt)
    if settings.GOOGLE_AI_API_KEY:
        return await _plan_with_gemini(system_prompt, user_prompt)
    raise RuntimeError("No AI provider API key configured for scene planning")


async def _plan_with_claude(system_prompt: str, user_prompt: str) -> dict:
    client = await get_http_client()
    response = await client.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": settings.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json={
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        },
    )
    response.raise_for_status()
    data = response.json()
    text = data["content"][0]["text"]
    return json.loads(text)


async def _plan_with_openai(system_prompt: str, user_prompt: str) -> dict:
    client = await get_http_client()
    response = await client.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4o",
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        },
    )
    response.raise_for_status()
    data = response.json()
    text = data["choices"][0]["message"]["content"]
    return json.loads(text)


async def _plan_with_gemini(system_prompt: str, user_prompt: str) -> dict:
    client = await get_http_client()
    response = await client.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": settings.GOOGLE_AI_API_KEY,
        },
        json={
            "contents": [
                {"parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}]}
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

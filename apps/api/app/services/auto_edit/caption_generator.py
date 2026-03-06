"""Caption generation using cloud-based Whisper + LLM formatting.

Uses Replicate for transcription and LLM for styling — no local models.
"""

import json

from app.config import settings
from app.http_client import get_http_client


async def format_captions_with_llm(
    segments: list[dict],
    style: str = "default",
) -> list[dict]:
    """Format Whisper transcript segments into styled captions using an LLM.

    Styles:
    - default: clean, readable captions
    - viral: bold, word-by-word animated captions (TikTok/Reels style)
    - karaoke: word-by-word highlighting with timing
    - minimal: short, clean text only

    Returns list of caption objects for the timeline.
    """
    style_instructions = {
        "default": "Create clean, readable captions. Group words into natural phrases of 4-8 words. Capitalize first word of each phrase.",
        "viral": "Create viral-style captions: short punchy phrases (2-4 words), ALL CAPS for emphasis words, add emoji where appropriate. Each word should have individual timing for word-by-word animation.",
        "karaoke": "Create karaoke-style captions: each word gets individual timing for highlighting. Group into lines of 4-6 words.",
        "minimal": "Create minimal captions: short clean text, lowercase, no punctuation, 3-5 words per caption.",
    }

    prompt = f"""Convert these transcript segments into styled video captions.

Style: {style}
Instructions: {style_instructions.get(style, style_instructions["default"])}

Transcript segments:
{json.dumps(segments[:200], indent=2)}

Return ONLY valid JSON:
{{
    "captions": [
        {{
            "text": "caption text here",
            "start": 0.0,
            "end": 2.5,
            "words": [
                {{"word": "caption", "start": 0.0, "end": 0.5}},
                {{"word": "text", "start": 0.5, "end": 0.8}},
                {{"word": "here", "start": 0.8, "end": 1.0}}
            ],
            "style": "{style}"
        }}
    ]
}}"""

    # Use first available provider
    if settings.OPENAI_API_KEY:
        return await _format_with_openai(prompt)
    if settings.GOOGLE_AI_API_KEY:
        return await _format_with_gemini(prompt)
    if settings.ANTHROPIC_API_KEY:
        return await _format_with_claude(prompt)

    # Fallback: return segments as-is
    return [
        {
            "text": seg.get("text", ""),
            "start": seg.get("start", 0),
            "end": seg.get("end", 0),
            "words": seg.get("words", []),
            "style": style,
        }
        for seg in segments
    ]


async def _format_with_openai(prompt: str) -> list[dict]:
    client = await get_http_client()
    response = await client.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4o-mini",
            "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": prompt}],
        },
    )
    response.raise_for_status()
    data = response.json()
    text = data["choices"][0]["message"]["content"]
    return json.loads(text).get("captions", [])


async def _format_with_gemini(prompt: str) -> list[dict]:
    client = await get_http_client()
    response = await client.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
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
    return json.loads(text).get("captions", [])


async def _format_with_claude(prompt: str) -> list[dict]:
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
            "messages": [{"role": "user", "content": prompt}],
        },
    )
    response.raise_for_status()
    data = response.json()
    text = data["content"][0]["text"]
    return json.loads(text).get("captions", [])

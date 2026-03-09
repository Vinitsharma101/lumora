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
        "default": "Create clean, readable captions. Group words into natural phrases of 4-8 words. Capitalize first word of each phrase. Set fontFamily to 'Inter', color to '#FFFFFF'.",
        "viral": "Create viral-style captions: short punchy phrases (1-3 words max). ALL CAPS for emphasis words. Set fontFamily to 'Anton'. Use bright colors like '#FFFF00' (yellow) or '#00FF00' (green) for emphasis chunks, otherwise '#FFFFFF'. Each word should have individual timing for word-by-word animation.",
        "viral_hormozi": "Create viral-style captions: short punchy phrases (1-3 words max). ALL CAPS for emphasis words. Set fontFamily to 'Anton'. Use bright colors like '#FFFF00' (yellow) or '#00FF00' (green) for emphasis chunks, otherwise '#FFFFFF'. Each word should have individual timing for word-by-word animation.",
        "karaoke": "Create karaoke-style captions: display the full line but highlight one word at a time as it's spoken. Use word-level timing. Set fontFamily to 'Roboto'. Active word color '#FFFF00' (yellow), inactive words '#AAAAAA' (gray). Each word gets its own timing entry.",
        "minimal": "Create minimal captions: short, clean text only. 3-5 words max per caption. No background, no styling effects. Set fontFamily to 'Inter', color to '#FFFFFF'. Simple and unobtrusive.",
        "mrbeast_gaming": "Create high-energy gaming style captions: 2-4 words maximum. Set fontFamily to 'Bangers'. Set color to '#FFFFFF' and backgroundColor to '#000000' (with slight padding). Use dramatic ALL CAPS for action phrases.",
        "cinematic": "Create cinematic subtitles: slow pacing, elegant, 5-8 words per line. Set fontFamily to 'Montserrat', color to '#FFFFFF', and backgroundColor to 'transparent'. NO ALL CAPS, rely on proper punctuation.",
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
            "fontFamily": "Inter",
            "color": "#FFFFFF",
            "backgroundColor": "transparent",
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


async def translate_captions(
    captions: list[dict],
    target_language: str,
) -> list[dict]:
    """Translate caption texts while preserving timing structure."""
    prompt = f"""Translate these video captions to {target_language}.
Keep the exact same JSON structure. Only change the "text" and "words" (word text only).
Preserve all timing values exactly as they are.

Captions:
{json.dumps(captions[:200], indent=2)}

Return ONLY valid JSON:
{{"captions": [...]}}"""

    if settings.OPENAI_API_KEY:
        return await _format_with_openai(prompt)
    if settings.GOOGLE_AI_API_KEY:
        return await _format_with_gemini(prompt)
    if settings.ANTHROPIC_API_KEY:
        return await _format_with_claude(prompt)
    return captions


async def add_emojis_to_captions(
    captions: list[dict],
) -> list[dict]:
    """Add contextual emojis to caption texts."""
    prompt = f"""Add relevant emojis to these video captions.
Insert 1-2 emojis per caption that match the content/emotion.
Place emojis at the end of the text or between phrases where natural.
Keep all timing and structure identical. Only modify the "text" field.

Captions:
{json.dumps(captions[:200], indent=2)}

Return ONLY valid JSON:
{{"captions": [...]}}"""

    if settings.OPENAI_API_KEY:
        return await _format_with_openai(prompt)
    if settings.GOOGLE_AI_API_KEY:
        return await _format_with_gemini(prompt)
    if settings.ANTHROPIC_API_KEY:
        return await _format_with_claude(prompt)
    return captions

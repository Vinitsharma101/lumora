import asyncio

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from app.config import settings
from app.http_client import get_http_client
from app.rate_limit import check_rate_limit
from app.schemas.ai import MusicRequest

router = APIRouter(tags=["ai"])

MAX_POLL_ATTEMPTS = 60
POLL_INTERVAL_SECONDS = 2


@router.post("/api/ai/music")
async def generate_music(body: MusicRequest, request: Request):
    await check_rate_limit(request)

    if not settings.SUNO_API_KEY or not settings.SUNO_API_URL:
        return JSONResponse(
            {"error": "Suno API not configured. Set SUNO_API_KEY and SUNO_API_URL."},
            status_code=400,
        )

    client = await get_http_client()

    # Start generation
    generate_response = await client.post(
        f"{settings.SUNO_API_URL}/api/generate",
        headers={
            "Authorization": f"Bearer {settings.SUNO_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "prompt": body.prompt,
            "make_instrumental": True,
            "wait_audio": False,
        },
    )

    if generate_response.status_code != 200:
        return JSONResponse(
            {"error": f"Suno API error: {generate_response.text}"},
            status_code=generate_response.status_code,
        )

    generate_data = generate_response.json()
    song_ids = [item["id"] for item in generate_data]

    if not song_ids:
        return JSONResponse({"error": "No songs generated"}, status_code=500)

    # Poll for completion
    song_id = song_ids[0]
    audio_url = None

    for _ in range(MAX_POLL_ATTEMPTS):
        await asyncio.sleep(POLL_INTERVAL_SECONDS)

        status_response = await client.get(
            f"{settings.SUNO_API_URL}/api/get",
            params={"ids": song_id},
            headers={"Authorization": f"Bearer {settings.SUNO_API_KEY}"},
        )

        if status_response.status_code != 200:
            continue

        status_data = status_response.json()
        song = status_data[0] if status_data else None

        if song and song.get("status") == "complete" and song.get("audio_url"):
            audio_url = song["audio_url"]
            break

        if song and song.get("status") == "error":
            return JSONResponse({"error": "Music generation failed"}, status_code=500)

    if not audio_url:
        return JSONResponse({"error": "Music generation timed out"}, status_code=504)

    # Download the audio
    audio_response = await client.get(audio_url)
    if audio_response.status_code != 200:
        return JSONResponse({"error": "Failed to download generated music"}, status_code=500)

    return Response(
        content=audio_response.content,
        media_type="audio/mpeg",
        headers={"Content-Length": str(len(audio_response.content))},
    )

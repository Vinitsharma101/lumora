from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from app.config import settings
from app.http_client import get_http_client
from app.rate_limit import check_rate_limit
from app.schemas.ai import VoiceRequest

router = APIRouter(tags=["ai"])

DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # Rachel
DEFAULT_MODEL_ID = "eleven_multilingual_v2"


@router.post("/api/ai/voice")
async def generate_voice(body: VoiceRequest, request: Request):
    await check_rate_limit(request)

    if not settings.ELEVENLABS_API_KEY:
        return JSONResponse(
            {"error": "ElevenLabs API key not configured. Set ELEVENLABS_API_KEY."},
            status_code=400,
        )

    voice_id = body.voiceId or DEFAULT_VOICE_ID
    model_id = body.modelId or DEFAULT_MODEL_ID

    client = await get_http_client()
    response = await client.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        headers={
            "xi-api-key": settings.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        json={
            "text": body.text,
            "model_id": model_id,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        },
    )

    if response.status_code != 200:
        return JSONResponse(
            {"error": f"ElevenLabs API error: {response.text}"},
            status_code=response.status_code,
        )

    return Response(
        content=response.content,
        media_type="audio/mpeg",
        headers={"Content-Length": str(len(response.content))},
    )

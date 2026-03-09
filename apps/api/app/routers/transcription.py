"""Server-side transcription endpoint using faster-whisper."""

import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, status

from app.auth import get_current_user
from app.models import User
from app.rate_limit import check_rate_limit

router = APIRouter(tags=["transcription"])


@router.post("/api/transcription/transcribe")
async def transcribe(
    request: Request,
    file: UploadFile = File(...),
    language: str = Form("auto"),
    model: str = Form("large-v3"),
    user: User = Depends(get_current_user),
):
    """Transcribe an audio file with word-level timestamps.

    Returns segments with word-level timing for karaoke-style captions.
    """
    await check_rate_limit(request)

    valid_models = {"tiny", "small", "medium", "large-v3"}
    if model not in valid_models:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid model. Choose from: {', '.join(valid_models)}",
        )

    suffix = Path(file.filename).suffix if file.filename else ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        from app.services.transcription.whisper_service import transcribe_audio

        result = transcribe_audio(
            audio_path=tmp_path,
            language=None if language == "auto" else language,
            model_size=model,
        )
        return result
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="faster-whisper is not installed on this server",
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)

"""Server-side transcription using faster-whisper.

Provides word-level timestamps and 100+ language support.
"""

from faster_whisper import WhisperModel


_model_cache: dict[str, WhisperModel] = {}


def _get_model(model_size: str = "large-v3") -> WhisperModel:
    if model_size not in _model_cache:
        _model_cache[model_size] = WhisperModel(
            model_size,
            device="auto",
            compute_type="auto",
        )
    return _model_cache[model_size]


def transcribe_audio(
    audio_path: str,
    language: str | None = None,
    model_size: str = "large-v3",
) -> dict:
    """Transcribe an audio file and return segments with word-level timestamps.

    Returns:
        {
            "language": "en",
            "segments": [
                {
                    "text": "Hello world",
                    "start": 0.0,
                    "end": 1.5,
                    "words": [
                        {"word": "Hello", "start": 0.0, "end": 0.7},
                        {"word": "world", "start": 0.8, "end": 1.5}
                    ]
                }
            ]
        }
    """
    model = _get_model(model_size)

    segments_iter, info = model.transcribe(
        audio_path,
        language=language,
        word_timestamps=True,
        vad_filter=True,
    )

    segments = []
    for segment in segments_iter:
        words = []
        if segment.words:
            for word_info in segment.words:
                words.append({
                    "word": word_info.word.strip(),
                    "start": round(word_info.start, 3),
                    "end": round(word_info.end, 3),
                })

        segments.append({
            "text": segment.text.strip(),
            "start": round(segment.start, 3),
            "end": round(segment.end, 3),
            "words": words,
        })

    return {
        "language": info.language,
        "segments": segments,
    }

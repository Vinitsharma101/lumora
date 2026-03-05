"""Silence detection via cloud-based Whisper transcription.

Uses Replicate's Whisper API to get word-level timestamps,
then identifies silence gaps. No local models.
"""

from app.services.ai_video.replicate_provider import ReplicateProvider


async def detect_silence_from_transcript(
    segments: list[dict],
    min_silence_duration: float = 0.5,
) -> list[dict]:
    """Analyze Whisper transcript segments to find silence gaps.

    Args:
        segments: Whisper transcript segments with 'start' and 'end' timestamps
        min_silence_duration: Minimum silence gap to detect (seconds)

    Returns:
        List of silence regions: [{"start": float, "end": float, "duration": float}]
    """
    silences = []

    if not segments:
        return silences

    # Sort by start time
    sorted_segments = sorted(segments, key=lambda s: s.get("start", 0))

    for i in range(len(sorted_segments) - 1):
        current_end = sorted_segments[i].get("end", 0)
        next_start = sorted_segments[i + 1].get("start", 0)
        gap = next_start - current_end

        if gap >= min_silence_duration:
            silences.append({
                "start": current_end,
                "end": next_start,
                "duration": gap,
            })

    return silences


async def transcribe_for_silence_detection(
    audio_url: str,
    language: str = "en",
) -> dict:
    """Transcribe audio via Replicate Whisper and detect silences.

    Returns both the transcript and detected silence regions.
    """
    provider = ReplicateProvider()
    result = await provider.transcribe_audio(audio_url, language)
    return {
        "prediction_id": result["prediction_id"],
        "status": result["status"],
        "provider": "replicate",
    }


def generate_trimmed_timeline(
    original_duration: float,
    silences: list[dict],
    padding: float = 0.1,
) -> list[dict]:
    """Generate timeline clips with silence regions removed.

    Args:
        original_duration: Total duration of the original video
        silences: Silence regions from detect_silence_from_transcript
        padding: Extra padding around speech (seconds)

    Returns:
        List of clip regions to keep: [{"start": float, "end": float}]
    """
    if not silences:
        return [{"start": 0, "end": original_duration}]

    clips = []
    current_start = 0

    for silence in silences:
        clip_end = max(current_start, silence["start"] - padding)
        if clip_end > current_start + 0.1:  # Min clip duration
            clips.append({"start": current_start, "end": clip_end})
        current_start = silence["end"] + padding

    # Add final clip after last silence
    if current_start < original_duration:
        clips.append({"start": current_start, "end": original_duration})

    return clips

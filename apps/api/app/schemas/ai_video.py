"""Pydantic schemas for AI video generation and auto-edit features.

All AI operations use cloud APIs — no local models.
"""

from typing import Literal

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# AI Video Generation
# ---------------------------------------------------------------------------


class TextToVideoRequest(BaseModel):
    prompt: str
    duration: int = 4  # seconds
    aspect_ratio: Literal["16:9", "9:16", "1:1"] = "16:9"
    style: str | None = None
    provider: Literal["google_veo", "replicate", "openai_sora"] = "google_veo"
    project_id: str | None = None


class ImageToVideoRequest(BaseModel):
    image_url: str
    prompt: str | None = None
    duration: int = 4
    provider: Literal["google_veo", "replicate"] = "google_veo"
    project_id: str | None = None


class ScriptToScenesRequest(BaseModel):
    script: str
    style: str | None = None
    aspect_ratio: Literal["16:9", "9:16", "1:1"] = "16:9"
    provider: Literal["google_veo", "replicate", "openai_sora"] = "google_veo"
    project_id: str | None = None


class BackgroundRemoveRequest(BaseModel):
    video_url: str | None = None
    image_url: str | None = None
    project_id: str | None = None


class UpscaleRequest(BaseModel):
    video_url: str | None = None
    image_url: str | None = None
    scale: Literal[2, 4] = 2
    project_id: str | None = None


class StyleTransferRequest(BaseModel):
    video_url: str
    style_prompt: str
    strength: float = 0.7
    project_id: str | None = None


class AIAvatarRequest(BaseModel):
    face_image_url: str
    audio_url: str | None = None
    text: str | None = None
    voice_id: str | None = None
    project_id: str | None = None


class TextToImageRequest(BaseModel):
    prompt: str
    width: int = 1024
    height: int = 1024
    model: Literal["schnell", "dev"] = "schnell"
    style: str | None = None
    project_id: str | None = None


class VideoToVideoRequest(BaseModel):
    video_url: str
    prompt: str
    strength: float = 0.7
    provider: Literal["replicate"] = "replicate"
    project_id: str | None = None


class MediaUnderstandRequest(BaseModel):
    media_url: str
    media_type: Literal["image", "video", "audio"]
    question: str | None = None
    project_id: str | None = None


class TTSRequest(BaseModel):
    text: str
    voice_id: str = "21m00Tcm4TlvDq8ikWAM"  # Rachel (default)
    model_id: str = "eleven_multilingual_v2"
    stability: float = 0.5
    similarity_boost: float = 0.75
    project_id: str | None = None


class SoundEffectRequest(BaseModel):
    prompt: str
    duration_seconds: float | None = None
    project_id: str | None = None


class StoryboardScene(BaseModel):
    scene_number: int
    description: str
    duration: int
    camera_angle: str | None = None
    mood: str | None = None
    style_keywords: list[str] | None = None


class StoryboardResponse(BaseModel):
    scenes: list[StoryboardScene]
    total_duration: int
    style_guide: str | None = None


# ---------------------------------------------------------------------------
# AI Auto-Edit
# ---------------------------------------------------------------------------


class AutoEditAnalyzeRequest(BaseModel):
    video_url: str
    project_id: str | None = None
    detect_scenes: bool = True
    detect_silence: bool = True
    detect_highlights: bool = True
    transcribe: bool = True


class SilenceRemoveRequest(BaseModel):
    video_url: str
    project_id: str | None = None
    min_silence_duration: float = 0.5  # seconds
    silence_threshold: float = -40.0  # dB


class AutoCaptionsRequest(BaseModel):
    video_url: str
    project_id: str | None = None
    language: str = "en"
    style: Literal["default", "viral", "karaoke", "minimal"] = "default"


class CreateShortsRequest(BaseModel):
    video_url: str
    project_id: str | None = None
    max_duration: int = 60  # seconds
    count: int = 3
    aspect_ratio: Literal["9:16", "1:1"] = "9:16"


class BeatSyncRequest(BaseModel):
    video_url: str
    music_url: str
    project_id: str | None = None


class AutoReframeRequest(BaseModel):
    video_url: str
    target_aspect_ratio: Literal["9:16", "1:1", "4:5"] = "9:16"
    project_id: str | None = None


class VoiceDubRequest(BaseModel):
    video_url: str
    target_language: str
    voice_id: str | None = None
    project_id: str | None = None


# ---------------------------------------------------------------------------
# AI Job Response (shared)
# ---------------------------------------------------------------------------


class AIJobResponse(BaseModel):
    job_id: str
    status: str
    job_type: str
    progress: float
    current_step: str | None = None
    chunks_total: int = 1
    chunks_completed: int = 0
    error_message: str | None = None
    output_url: str | None = None
    output_data: dict | None = None


class AIJobStatusResponse(BaseModel):
    id: str
    job_type: str
    status: str
    progress: float
    current_step: str | None = None
    chunks_total: int = 1
    chunks_completed: int = 0
    error_message: str | None = None
    output_url: str | None = None
    input_data: dict | None = None
    output_data: dict | None = None
    provider: str | None = None
    created_at: str
    completed_at: str | None = None

    model_config = {"from_attributes": True}

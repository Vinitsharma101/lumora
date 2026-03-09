from typing import Literal

from pydantic import BaseModel

from app.ai.providers.types import AIMessage, ToolDefinition


class ChatRequest(BaseModel):
    provider: Literal["claude", "openai", "gemini"]
    messages: list[AIMessage]
    tools: list[ToolDefinition] | None = None
    systemPrompt: str | None = None


class MusicRequest(BaseModel):
    prompt: str
    duration: int | None = None
    style: str | None = None


class VoiceRequest(BaseModel):
    text: str
    voiceId: str | None = None
    modelId: str | None = None


class StockDownloadRequest(BaseModel):
    url: str
    type: Literal["video", "image", "photo"]
    source: Literal["pexels", "pixabay"]


class RenderMotionRequest(BaseModel):
    compositionId: str
    props: dict | None = None
    width: int = 1920
    height: int = 1080
    fps: int = 30
    durationInFrames: int = 150

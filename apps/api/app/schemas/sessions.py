from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class CreateSessionRequest(BaseModel):
    userId: str
    projectId: str
    provider: Literal["claude", "openai", "gemini"]
    title: str | None = None


class CreateMessageRequest(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    toolCalls: str | None = None
    toolResults: str | None = None


class SessionResponse(BaseModel):
    id: str
    user_id: str
    project_id: str
    provider: str
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    tool_calls: str | None = None
    tool_results: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

"""Pydantic schemas for real-time collaboration."""

from typing import Literal

from pydantic import BaseModel


class ShareProjectRequest(BaseModel):
    email: str
    role: Literal["viewer", "editor"] = "editor"


class CollaboratorResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    email: str
    role: str


class WebSocketAuthMessage(BaseModel):
    type: Literal["auth"]
    token: str

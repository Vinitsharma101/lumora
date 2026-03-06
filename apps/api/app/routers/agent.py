"""
Agent Router — REST API endpoints for the agentic video creation pipeline.

Endpoints:
  POST /api/agent/execute/{project_id}  — Start an autonomous agent session
  POST /api/agent/answer/{session_id}   — Submit a clarifying Q&A answer
  GET  /api/agent/status/{session_id}   — Poll session progress
  POST /api/agent/character/{project_id} — Register a character for consistency
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.agents.orchestrator import AgentOrchestrator
from app.services.character_service import CharacterService
from app.auth import get_current_user_optional

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/agent", tags=["Agent"])


# ── Request / Response Schemas ────────────────────────────────────────────────

class AgentExecuteRequest(BaseModel):
    query: str
    context: dict = {}
    media_asset_ids: list[str] = []


class AgentAnswerRequest(BaseModel):
    question_id: str
    value: str


class CharacterRegisterRequest(BaseModel):
    name: str
    description: str
    reference_image_url: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/execute/{project_id}", status_code=status.HTTP_202_ACCEPTED)
async def execute_agent(
    project_id: str,
    request: AgentExecuteRequest,
    user=Depends(get_current_user_optional),
):
    """Start the autonomous agentic video creation pipeline."""
    user_id = user.id if user else "anonymous"

    orchestrator = AgentOrchestrator(
        project_id=project_id,
        user_id=user_id,
    )

    session_id = await orchestrator.start(
        query=request.query,
        context=request.context,
        media_assets=request.media_asset_ids,
    )

    return {
        "session_id": session_id,
        "status": "started",
        "message": "Agent pipeline started. Poll /api/agent/status/{session_id} for progress.",
    }


@router.post("/answer/{session_id}")
async def submit_answer(session_id: str, request: AgentAnswerRequest):
    """Submit a user answer to an agent's clarifying question."""
    try:
        orchestrator = await AgentOrchestrator.get_session(session_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found")

    await orchestrator.submit_answer(
        question_id=request.question_id,
        value=request.value,
    )

    return {"status": "received", "question_id": request.question_id}


@router.get("/status/{session_id}")
async def get_agent_status(session_id: str):
    """Poll the agent session for current status, questions, and progress."""
    try:
        orchestrator = await AgentOrchestrator.get_session(session_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found")

    return await orchestrator.get_status()


@router.post("/character/{project_id}")
async def register_character(
    project_id: str,
    request: CharacterRegisterRequest,
    user=Depends(get_current_user_optional),
):
    """Register a character for visual consistency across AI-generated scenes."""
    service = CharacterService()

    result = await service.register_character(
        project_id=project_id,
        name=request.name,
        description=request.description,
        reference_image_url=request.reference_image_url,
    )

    return result

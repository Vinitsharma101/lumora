from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AIChatMessage, AIChatSession
from app.rate_limit import check_rate_limit
from app.schemas.sessions import (
    CreateMessageRequest,
    CreateSessionRequest,
    MessageResponse,
    SessionResponse,
)

router = APIRouter(tags=["ai-sessions"])


@router.get("/api/ai/sessions")
async def list_sessions(
    userId: str = Query(...),
    projectId: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(AIChatSession).where(AIChatSession.user_id == userId)
    if projectId:
        query = query.where(AIChatSession.project_id == projectId)
    query = query.order_by(AIChatSession.updated_at.desc())

    result = await db.execute(query)
    sessions = result.scalars().all()
    return {"sessions": [SessionResponse.model_validate(s) for s in sessions]}


@router.post("/api/ai/sessions")
async def create_session(
    body: CreateSessionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request)

    now = datetime.now(timezone.utc)
    session_id = str(uuid4())

    session = AIChatSession(
        id=session_id,
        user_id=body.userId,
        project_id=body.projectId,
        provider=body.provider,
        title=body.title or "New Chat",
        created_at=now,
        updated_at=now,
    )
    db.add(session)
    await db.commit()
    return {"id": session_id}


@router.get("/api/ai/sessions/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AIChatSession).where(AIChatSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        return JSONResponse({"error": "Session not found"}, status_code=404)

    msg_result = await db.execute(
        select(AIChatMessage).where(AIChatMessage.session_id == session_id)
    )
    messages = msg_result.scalars().all()

    return {
        "session": SessionResponse.model_validate(session),
        "messages": [MessageResponse.model_validate(m) for m in messages],
    }


@router.delete("/api/ai/sessions/{session_id}")
async def delete_session(
    session_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request)
    await db.execute(delete(AIChatSession).where(AIChatSession.id == session_id))
    await db.commit()
    return {"success": True}


@router.post("/api/ai/sessions/{session_id}/messages")
async def create_message(
    session_id: str,
    body: CreateMessageRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request)

    message_id = str(uuid4())
    now = datetime.now(timezone.utc)

    message = AIChatMessage(
        id=message_id,
        session_id=session_id,
        role=body.role,
        content=body.content,
        tool_calls=body.toolCalls,
        tool_results=body.toolResults,
        created_at=now,
    )
    db.add(message)

    # Update session timestamp
    result = await db.execute(
        select(AIChatSession).where(AIChatSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session:
        session.updated_at = now

    await db.commit()
    return {"id": message_id}

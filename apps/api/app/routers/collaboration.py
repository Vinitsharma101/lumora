"""Real-time collaboration API and WebSocket endpoints.

Uses WebSocket for live cursor/selection sync and operational transforms.
Project sharing and collaborator management via REST endpoints.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Project, ProjectCollaborator, User
from app.rate_limit import check_rate_limit
from app.schemas.collaboration import (
    CollaboratorResponse,
    ShareProjectRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["collaboration"])

# In-memory connection registry (per instance — use Redis Pub/Sub for multi-instance)
_rooms: dict[str, dict[str, WebSocket]] = {}


async def _verify_project_access(
    db: AsyncSession, project_id: str, user_id: str
) -> Optional[str]:
    """Return the user's role if they have access, else None."""
    project = await db.get(Project, project_id)
    if not project:
        return None
    if project.user_id == user_id:
        return "owner"

    stmt = select(ProjectCollaborator).where(
        ProjectCollaborator.project_id == project_id,
        ProjectCollaborator.user_id == user_id,
    )
    result = await db.execute(stmt)
    collab = result.scalar_one_or_none()
    return collab.role if collab else None


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------


@router.post("/api/projects/{project_id}/share", response_model=CollaboratorResponse)
async def share_project(
    project_id: str,
    body: ShareProjectRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Share a project with another user."""
    await check_rate_limit(request)

    project = await db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if the target user exists
    stmt = select(User).where(User.email == body.email)
    result = await db.execute(stmt)
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if target_user.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot share with yourself")

    # Check for existing collaborator
    stmt = select(ProjectCollaborator).where(
        ProjectCollaborator.project_id == project_id,
        ProjectCollaborator.user_id == target_user.id,
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        existing.role = body.role
        await db.commit()
        await db.refresh(existing)
        return CollaboratorResponse(
            id=existing.id,
            project_id=existing.project_id,
            user_id=existing.user_id,
            email=target_user.email,
            role=existing.role,
        )

    collab = ProjectCollaborator(
        id=str(uuid4()),
        project_id=project_id,
        user_id=target_user.id,
        role=body.role,
        created_at=datetime.now(tz=timezone.utc),
    )
    db.add(collab)
    await db.commit()
    await db.refresh(collab)

    return CollaboratorResponse(
        id=collab.id,
        project_id=collab.project_id,
        user_id=collab.user_id,
        email=target_user.email,
        role=collab.role,
    )


@router.get("/api/projects/{project_id}/collaborators")
async def list_collaborators(
    project_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all collaborators on a project."""
    await check_rate_limit(request)

    role = await _verify_project_access(db, project_id, user.id)
    if not role:
        raise HTTPException(status_code=404, detail="Project not found")

    stmt = select(ProjectCollaborator).where(
        ProjectCollaborator.project_id == project_id,
    )
    result = await db.execute(stmt)
    collabs = result.scalars().all()

    items = []
    for collab in collabs:
        target = await db.get(User, collab.user_id)
        items.append(
            CollaboratorResponse(
                id=collab.id,
                project_id=collab.project_id,
                user_id=collab.user_id,
                email=target.email if target else "",
                role=collab.role,
            )
        )

    return {"collaborators": items}


@router.delete("/api/projects/{project_id}/collaborators/{collaborator_id}")
async def remove_collaborator(
    project_id: str,
    collaborator_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a collaborator from a project. Only the owner can do this."""
    await check_rate_limit(request)

    project = await db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    collab = await db.get(ProjectCollaborator, collaborator_id)
    if not collab or collab.project_id != project_id:
        raise HTTPException(status_code=404, detail="Collaborator not found")

    await db.delete(collab)
    await db.commit()

    return {"status": "removed"}


# ---------------------------------------------------------------------------
# WebSocket for real-time collaboration
# ---------------------------------------------------------------------------


@router.websocket("/ws/collaboration/{project_id}")
async def collaboration_websocket(
    websocket: WebSocket,
    project_id: str,
):
    """WebSocket endpoint for real-time collaborative editing.

    Protocol:
    1. Client sends auth message: {"type": "auth", "token": "..."}
    2. Server validates and responds with: {"type": "auth_ok", "user_id": "...", "role": "..."}
    3. Client and server exchange operations:
       - cursor_move: {"type": "cursor", "position": {...}}
       - selection: {"type": "selection", "elements": [...]}
       - operation: {"type": "operation", "op": {...}} — timeline mutations
       - presence: {"type": "presence", "status": "active|idle"}
       - chat: {"type": "chat", "message": "..."}
    """
    from app.database import async_session_factory

    await websocket.accept()

    user_id: Optional[str] = None
    user_role: Optional[str] = None

    try:
        # Wait for auth message
        auth_msg = await websocket.receive_json()
        if auth_msg.get("type") != "auth" or "token" not in auth_msg:
            await websocket.send_json({"type": "error", "message": "Auth required"})
            await websocket.close()
            return

        # Validate token
        from app.auth import decode_access_token

        try:
            payload = decode_access_token(auth_msg["token"])
            user_id = payload.get("sub")
        except Exception:
            await websocket.send_json({"type": "error", "message": "Invalid token"})
            await websocket.close()
            return

        # Check project access using a short-lived session
        async with async_session_factory() as db:
            user_role = await _verify_project_access(db, project_id, user_id)
        if not user_role:
            await websocket.send_json({"type": "error", "message": "Access denied"})
            await websocket.close()
            return

        # Join room
        if project_id not in _rooms:
            _rooms[project_id] = {}
        _rooms[project_id][user_id] = websocket

        await websocket.send_json({
            "type": "auth_ok",
            "user_id": user_id,
            "role": user_role,
            "peers": list(_rooms[project_id].keys()),
        })

        # Notify peers
        await _broadcast(project_id, user_id, {
            "type": "peer_joined",
            "user_id": user_id,
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        })

        # Message loop
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = message.get("type")

            if msg_type in ("cursor", "selection", "presence"):
                # Relay presence/cursor to all peers
                await _broadcast(project_id, user_id, {
                    **message,
                    "user_id": user_id,
                    "timestamp": datetime.now(tz=timezone.utc).isoformat(),
                })

            elif msg_type == "operation":
                # Relay timeline operation — clients apply OT/CRDT resolution
                if user_role in ("owner", "editor"):
                    await _broadcast(project_id, user_id, {
                        **message,
                        "user_id": user_id,
                        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
                    })
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Viewers cannot perform operations",
                    })

            elif msg_type == "chat":
                await _broadcast(project_id, user_id, {
                    "type": "chat",
                    "user_id": user_id,
                    "message": message.get("message", ""),
                    "timestamp": datetime.now(tz=timezone.utc).isoformat(),
                })

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception(f"WebSocket error for project {project_id}")
    finally:
        # Leave room
        if project_id in _rooms and user_id in _rooms.get(project_id, {}):
            del _rooms[project_id][user_id]
            if not _rooms[project_id]:
                del _rooms[project_id]
            else:
                await _broadcast(project_id, user_id or "", {
                    "type": "peer_left",
                    "user_id": user_id,
                    "timestamp": datetime.now(tz=timezone.utc).isoformat(),
                })


async def _broadcast(
    project_id: str, sender_id: str, message: dict
) -> None:
    """Broadcast a message to all peers in a room except the sender."""
    room = _rooms.get(project_id, {})
    dead_connections = []

    for uid, ws in room.items():
        if uid == sender_id:
            continue
        try:
            await ws.send_json(message)
        except Exception:
            dead_connections.append(uid)

    for uid in dead_connections:
        del room[uid]

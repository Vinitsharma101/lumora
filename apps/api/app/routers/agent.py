"""
Agent Router — REST API endpoints for the agentic video creation pipeline.

Endpoints:
  POST /api/agent/execute/{project_id}  — Start an autonomous agent session
  POST /api/agent/answer/{session_id}   — Submit a clarifying Q&A answer
  POST /api/agent/approve/{session_id}  — Approve a checkpoint (cost/review)
  GET  /api/agent/status/{session_id}   — Poll session progress (granular)
  GET  /api/agent/stream/{session_id}   — Real-time status updates via SSE (Upstash Redis)
  POST /api/agent/character/{project_id} — Register a character for consistency
"""

import asyncio
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.orchestrator import AgentOrchestrator
from app.database import get_db
from app.models import Project
from app.services.character_service import CharacterService
from app.services.cost_estimator import estimate_pipeline_cost
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


class AgentApproveRequest(BaseModel):
    checkpoint: str  # "cost_approval", "storyboard", "act_review", "final_review"
    approved: bool = True
    feedback: str | None = None


class AgentRegenerateRequest(BaseModel):
    scene_index: int
    modified_prompt: str | None = None


class CharacterRegisterRequest(BaseModel):
    name: str
    description: str
    reference_image_url: str | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/execute/{project_id}", status_code=status.HTTP_202_ACCEPTED)
async def execute_agent(
    project_id: str,
    request: AgentExecuteRequest,
    user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Start the autonomous agentic video creation pipeline."""
    logger.info(
        "agent.execute hit: project_id=%s user_id=%s query=%r context_keys=%s media_assets=%d",
        project_id,
        getattr(user, "id", None),
        request.query,
        list(request.context.keys()) if isinstance(request.context, dict) else None,
        len(request.media_asset_ids),
    )

    if user:
        user_id = user.id
    else:
        project_result = await db.execute(select(Project).where(Project.id == project_id))
        project = project_result.scalar_one_or_none()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        user_id = project.user_id

    orchestrator = AgentOrchestrator(
        project_id=project_id,
        user_id=user_id,
    )

    try:
        session_id = await orchestrator.start(
            query=request.query,
            context=request.context,
            media_assets=request.media_asset_ids,
        )
    except Exception as e:
        logger.error(
            f"Failed to start agent session for project {project_id}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start agent session: {str(e)}. "
            "Check that the database is configured and the agent_sessions table exists.",
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
    except Exception as e:
        logger.error(f"Failed to load session {session_id}: {e}")
        raise HTTPException(status_code=503, detail="Database unavailable. Check DATABASE_URL configuration.")

    await orchestrator.submit_answer(
        question_id=request.question_id,
        value=request.value,
    )

    return {"status": "received", "question_id": request.question_id}


@router.get("/status/{session_id}")
async def get_agent_status(session_id: str):
    """Poll the agent session for current status, questions, and granular progress."""
    try:
        orchestrator = await AgentOrchestrator.get_session(session_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found")
    except Exception as e:
        logger.error(f"Failed to load session {session_id}: {e}")
        raise HTTPException(status_code=503, detail="Database unavailable. Check DATABASE_URL configuration.")

    base_status = await orchestrator.get_status()

    # Add granular per-scene/act progress
    base_status["acts_progress"] = orchestrator.state.get("acts_progress", {})
    base_status["cost_estimate"] = orchestrator.state.get("cost_estimate")
    base_status["show_bible"] = orchestrator.state.get("show_bible")
    base_status["character_profiles"] = orchestrator.state.get("character_profiles", {})
    base_status["consistency_checked"] = orchestrator.state.get("consistency_checked", False)

    # Count completed scenes
    assembled = orchestrator.state.get("assembled_timeline", {})
    if isinstance(assembled, dict):
        completed_scenes = len([k for k in assembled.keys() if k.startswith("scene_")])
        base_status["scenes_completed"] = completed_scenes

    scene_plan = orchestrator.state.get("scene_plan", [])
    scenes_total = len(scene_plan) if isinstance(scene_plan, list) else 0
    base_status["scenes_total"] = scenes_total

    # Per-scene status map for granular progress tracking
    scene_statuses = {}
    for i in range(scenes_total):
        scene_key = f"scene_{i}"
        if isinstance(assembled, dict) and scene_key in assembled:
            scene_statuses[str(i)] = "completed"
        elif orchestrator.state.get("status") in ("processing", "generating", "editing"):
            acts_progress = orchestrator.state.get("acts_progress", {})
            is_processing = any(
                act.get("status") == "processing"
                for act in acts_progress.values()
                if isinstance(act, dict)
            )
            scene_statuses[str(i)] = "processing" if is_processing else "pending"
        else:
            scene_statuses[str(i)] = "pending"
    base_status["scene_statuses"] = scene_statuses

    return base_status


@router.post("/approve/{session_id}")
async def approve_checkpoint(session_id: str, request: AgentApproveRequest):
    """Approve a pipeline checkpoint to continue processing."""
    try:
        orchestrator = await AgentOrchestrator.get_session(session_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found")
    except Exception as e:
        logger.error(f"Failed to load session {session_id}: {e}")
        raise HTTPException(status_code=503, detail="Database unavailable. Check DATABASE_URL configuration.")

    if not request.approved:
        orchestrator.state["status"] = "paused"
        if request.feedback:
            orchestrator.state["messages"] = orchestrator.state.get("messages", []) + [
                {"role": "user", "content": f"Feedback: {request.feedback}"}
            ]
        await orchestrator.save_state()
        return {"status": "paused", "checkpoint": request.checkpoint}

    # Resume pipeline based on checkpoint type
    from app.worker import get_arq_pool

    if request.checkpoint == "cost_approval":
        orchestrator.state["cost_approved"] = True
        orchestrator.state["status"] = "processing"
        await orchestrator.save_state()
        pool = await get_arq_pool()
        await pool.enqueue_job("process_movie_director", session_id)

    elif request.checkpoint == "storyboard":
        orchestrator.state["storyboard_approved"] = True
        orchestrator.state["status"] = "processing"
        if request.feedback:
            orchestrator.state["messages"] = orchestrator.state.get("messages", []) + [
                {"role": "user", "content": f"Storyboard feedback: {request.feedback}"}
            ]
        await orchestrator.save_state()
        pool = await get_arq_pool()
        await pool.enqueue_job("process_movie_director", session_id)

    elif request.checkpoint == "act_review":
        orchestrator.state["status"] = "processing"
        if request.feedback:
            orchestrator.state["messages"] = orchestrator.state.get("messages", []) + [
                {"role": "user", "content": f"Review feedback: {request.feedback}"}
            ]
        await orchestrator.save_state()

    elif request.checkpoint == "final_review":
        orchestrator.state["status"] = "processing"
        await orchestrator.save_state()
        pool = await get_arq_pool()
        await pool.enqueue_job("process_movie_assembly", session_id)

    return {"status": "approved", "checkpoint": request.checkpoint}


@router.post("/regenerate/{session_id}", status_code=status.HTTP_202_ACCEPTED)
async def regenerate_scene(session_id: str, request: AgentRegenerateRequest):
    """Regenerate a specific scene within an active pipeline session."""
    try:
        orchestrator = await AgentOrchestrator.get_session(session_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found")
    except Exception as e:
        logger.error(f"Failed to load session {session_id}: {e}")
        raise HTTPException(status_code=503, detail="Database unavailable. Check DATABASE_URL configuration.")

    scene_plan = orchestrator.state.get("scene_plan", [])
    if request.scene_index >= len(scene_plan):
        raise HTTPException(status_code=400, detail="Invalid scene index")

    if request.modified_prompt:
        scene_plan[request.scene_index]["description"] = request.modified_prompt
        scene_plan[request.scene_index]["prompt"] = request.modified_prompt
        orchestrator.state["scene_plan"] = scene_plan
        await orchestrator.save_state()

    from app.worker import get_arq_pool
    pool = await get_arq_pool()
    await pool.enqueue_job("process_movie_scene", session_id, request.scene_index)

    return {
        "status": "regenerating",
        "scene_index": request.scene_index,
        "message": f"Scene {request.scene_index} queued for regeneration.",
    }


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


# ── Real-time updates via Redis (Upstash-compatible) + SSE ────────────────────

AGENT_STATUS_KEY_PREFIX = "agent:status:"
AGENT_STATUS_TTL = 3600  # 1 hour


async def cache_agent_status(session_id: str, status_data: dict):
    """Write a status snapshot to Redis for fast polling / SSE streaming.

    Uses simple GET/SET (Upstash REST-compatible) instead of pub/sub.
    """
    try:
        from app.rate_limit import get_redis

        redis = await get_redis()
        key = f"{AGENT_STATUS_KEY_PREFIX}{session_id}"
        await redis.set(key, json.dumps(status_data, default=str), ex=AGENT_STATUS_TTL)
    except Exception as e:
        logger.debug(f"Failed to cache agent status: {e}")


@router.get("/stream/{session_id}")
async def stream_agent_status(session_id: str):
    """SSE endpoint for real-time agent status updates.

    Polls the Redis-cached status snapshot every second and streams
    changes to the client. Upstash-compatible (no pub/sub required).
    """
    # Verify session exists
    try:
        await AgentOrchestrator.get_session(session_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found")
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    async def event_generator():
        from app.rate_limit import get_redis

        last_status_hash = ""
        key = f"{AGENT_STATUS_KEY_PREFIX}{session_id}"

        while True:
            try:
                redis = await get_redis()
                cached = await redis.get(key)

                if cached and cached != last_status_hash:
                    last_status_hash = cached
                    yield f"data: {cached}\n\n"

                    # Stop streaming if terminal state
                    data = json.loads(cached)
                    if data.get("status") in ("completed", "failed"):
                        break
            except Exception:
                pass

            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

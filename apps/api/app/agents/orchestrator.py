"""
Agentic Orchestrator — Manages the full autonomous video creation pipeline.

This has been refactored for the 1-hour movie pipeline:
1. Orchestrator now uses ARQ background jobs (`worker.py`) instead of running locally.
2. It relies on the `AgentSession` database model for persistence and resumption.
"""

import uuid
import logging
from typing import Optional
from datetime import datetime, timezone

from sqlalchemy import select

from app.database import async_session_factory
from app.models import AgentSession
from app.worker import get_arq_pool

logger = logging.getLogger(__name__)


class AgentState(dict):
    """Typed state dictionary flowing through the agent pipeline."""
    pass


class AgentOrchestrator:
    """Manages an autonomous video-creation session using ARQ & DB persistence."""

    def __init__(self, project_id: Optional[str] = None, user_id: Optional[str] = None):
        self.project_id = project_id
        self.user_id = user_id
        self.session_id: Optional[str] = None
        self.state: AgentState = AgentState()

    async def start(self, query: str, context: dict, media_assets: list) -> str:
        """Start the agentic pipeline, save to DB, and enqueue ARQ job."""
        self.session_id = str(uuid.uuid4())
        
        self.state = AgentState(
            project_id=self.project_id,
            user_id=self.user_id,
            original_query=query,
            clarified_context={**context, "media_assets": media_assets},
            pending_questions=[],
            answered_questions={},
            scene_plan={},
            character_profiles={},
            generated_assets=[],
            timeline_plan={},
            assembled_timeline={},
            raw_video_url=context.get("raw_video_url"),
            chunk_metadata=[],
            video_map={},
            global_style_context={},
            review_notes=[],
            status="started",
            messages=[],
            error=None,
            _retry_count=0,
        )

        # Save initial state to DB
        async with async_session_factory() as db:
            session_model = AgentSession(
                id=self.session_id,
                project_id=self.project_id,
                user_id=self.user_id,
                status=self.state["status"],
                query=query,
                plan={},
                pending_questions=[],
                answered_questions={},
                generated_assets=[],
                assembled_timeline={},
                raw_video_url=context.get("raw_video_url"),
                chunk_metadata=[],
                video_map={},
                global_style_context={},
                review_notes=[],
                messages=[],
                error=None,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(session_model)
            await db.commit()

        # Enqueue the top-level job via ARQ
        pool = await get_arq_pool()
        if context.get("raw_video_url"):
            await pool.enqueue_job("process_movie_ingestion", self.session_id)
        else:
            await pool.enqueue_job("process_movie_director", self.session_id)

        return self.session_id

    async def load_state(self):
        """Load state from DB into self.state."""
        if not self.session_id:
            raise ValueError("session_id must be set to load state")
            
        async with async_session_factory() as db:
            stmt = select(AgentSession).where(AgentSession.id == self.session_id)
            result = await db.execute(stmt)
            model = result.scalar_one_or_none()
            if not model:
                raise ValueError(f"Session {self.session_id} not found")
                
            self.project_id = model.project_id
            self.user_id = model.user_id
            
            self.state = AgentState(
                project_id=model.project_id,
                user_id=model.user_id,
                original_query=model.query,
                clarified_context={"media_assets": []}, # Basic default
                pending_questions=model.pending_questions or [],
                answered_questions=model.answered_questions or {},
                scene_plan=model.plan or {},
                character_profiles={},
                generated_assets=model.generated_assets or [],
                timeline_plan={},
                assembled_timeline=model.assembled_timeline or {},
                raw_video_url=model.raw_video_url,
                chunk_metadata=model.chunk_metadata or [],
                video_map=model.video_map or {},
                global_style_context=model.global_style_context or {},
                review_notes=model.review_notes or [],
                status=model.status,
                messages=model.messages or [],
                error=model.error,
                _retry_count=0,
            )

    async def save_state(self):
        """Save self.state back to DB."""
        if not self.session_id:
            return
            
        async with async_session_factory() as db:
            stmt = select(AgentSession).where(AgentSession.id == self.session_id)
            result = await db.execute(stmt)
            model = result.scalar_one_or_none()
            if model:
                model.status = self.state.get("status", "running")
                model.plan = self.state.get("scene_plan", {})
                model.pending_questions = self.state.get("pending_questions", [])
                model.answered_questions = self.state.get("answered_questions", {})
                model.generated_assets = self.state.get("generated_assets", [])
                model.assembled_timeline = self.state.get("assembled_timeline", {})
                model.raw_video_url = self.state.get("raw_video_url")
                model.chunk_metadata = self.state.get("chunk_metadata", [])
                model.video_map = self.state.get("video_map", {})
                model.global_style_context = self.state.get("global_style_context", {})
                model.review_notes = self.state.get("review_notes", [])
                model.messages = self.state.get("messages", [])
                model.error = self.state.get("error")
                model.updated_at = datetime.now(timezone.utc)
                await db.commit()

    async def submit_answer(self, question_id: str, value: str):
        """Submit a user answer and resume the ARQ pipeline."""
        await self.load_state()
        
        answered = self.state.get("answered_questions", {})
        answered[question_id] = value
        self.state["answered_questions"] = answered

        # Remove from pending
        pending = self.state.get("pending_questions", [])
        self.state["pending_questions"] = [q for q in pending if q.get("id") != question_id]
        
        await self.save_state()

        # If all questions answered, resume pipeline
        if not self.state["pending_questions"]:
            pool = await get_arq_pool()
            await pool.enqueue_job("process_movie_director", self.session_id)

    async def get_status(self) -> dict:
        """Return current session status from DB for polling."""
        await self.load_state()
        return {
            "session_id": self.session_id,
            "status": self.state.get("status", "unknown"),
            "pending_questions": self.state.get("pending_questions", []),
            "scene_plan": self.state.get("scene_plan"),
            "generated_assets_count": len(self.state.get("generated_assets", [])),
            "assembled_timeline": self.state.get("assembled_timeline"),
            "review_score": self.state.get("review_score"),
            "review_suggestions": self.state.get("review_suggestions", []),
            "messages": self.state.get("messages", []),
            "error": self.state.get("error"),
        }

    @classmethod
    async def get_session(cls, session_id: str) -> "AgentOrchestrator":
        """Retrieve an active session by ID from DB."""
        orchestrator = cls()
        orchestrator.session_id = session_id
        await orchestrator.load_state()
        return orchestrator

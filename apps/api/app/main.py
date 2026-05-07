from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import health, auth, ai_chat, ai_music, ai_stock, ai_voice
from app.routers import ai_sessions, sounds
from app.routers import projects, media, render, ai_video, auto_edit, collaboration
from app.routers import agent as agent_router
from app.routers import transcription

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup/shutdown lifecycle: create tables, initialize Supabase buckets, clean up on shutdown."""
    logger.info("Registered routes at startup:")
    for route in application.routes:
        path = getattr(route, "path", None)
        if path:
            logger.info(path)

    # Auto-create tables for local dev (no-op if they already exist)
    try:
        from app.database import engine
        from app.models import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception:
        pass  # DB may not be available in some environments

    try:
        from app.supabase_client import ensure_buckets_exist
        await ensure_buckets_exist()
    except Exception:
        pass  # Supabase is optional for local dev
    yield
    # Shutdown: close shared connections
    from app.http_client import close_http_client
    from app.rate_limit import close_redis
    await close_http_client()
    await close_redis()


app = FastAPI(title="Grace Studio API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- existing routers ---
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(ai_chat.router)
app.include_router(ai_music.router)
app.include_router(ai_stock.router)
app.include_router(ai_voice.router)
app.include_router(ai_sessions.router)
app.include_router(sounds.router)

# --- new platform routers ---
app.include_router(projects.router)
app.include_router(media.router)
app.include_router(render.router)
app.include_router(ai_video.router)
app.include_router(auto_edit.router)
app.include_router(collaboration.router)

# --- transcription ---
app.include_router(transcription.router)

# --- agentic pipeline ---
app.include_router(agent_router.router)


@app.get("/api/debug/routes")
async def debug_routes():
    return {
        "routes": [route.path for route in app.routes if getattr(route, "path", None)],
    }

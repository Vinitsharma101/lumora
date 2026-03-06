from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import health, auth, ai_chat, ai_music, ai_voice, ai_stock, ai_render_motion
from app.routers import ai_sessions, sounds
from app.routers import projects, media, render, ai_video, auto_edit, collaboration
from app.routers import agent as agent_router


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup/shutdown lifecycle: initialize Supabase buckets, clean up on shutdown."""
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


app = FastAPI(title="OpenCut API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- existing routers ---
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(ai_chat.router)
app.include_router(ai_music.router)
app.include_router(ai_voice.router)
app.include_router(ai_stock.router)
app.include_router(ai_render_motion.router)
app.include_router(ai_sessions.router)
app.include_router(sounds.router)

# --- new platform routers ---
app.include_router(projects.router)
app.include_router(media.router)
app.include_router(render.router)
app.include_router(ai_video.router)
app.include_router(auto_edit.router)
app.include_router(collaboration.router)

# --- agentic pipeline ---
app.include_router(agent_router.router)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import health, auth, ai_chat, ai_music, ai_voice, ai_stock, ai_render_motion
from app.routers import ai_sessions, sounds

app = FastAPI(title="OpenCut API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(ai_chat.router)
app.include_router(ai_music.router)
app.include_router(ai_voice.router)
app.include_router(ai_stock.router)
app.include_router(ai_render_motion.router)
app.include_router(ai_sessions.router)
app.include_router(sounds.router)

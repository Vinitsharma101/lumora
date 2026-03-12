# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also the root [CLAUDE.md](../../CLAUDE.md) for monorepo-wide conventions.

## Commands

```bash
# Install dependencies
pip install -e ".[dev]"

# Run API server (development)
uvicorn app.main:app --reload --port 8000

# Run ARQ background worker
arq app.worker.WorkerSettings

# Lint
ruff check .
ruff check --fix .

# Format
ruff format .

# Test
pytest test_pipeline.py
```

## Code Style

- **Ruff** for linting and formatting
- Python 3.12 target, 100-char line length
- Lint rules: `E`, `F`, `I`, `N`, `W`, `UP` (pyflakes, isort, naming, pyupgrade)
- Async-first: use `async def` for all route handlers and service methods

## Architecture

### Entry Point

`app/main.py` creates the FastAPI app with CORS, lifespan hooks, and router registration. Config via Pydantic `BaseSettings` in `app/config.py`, loaded from `.env`.

### Agentic Video Pipeline

The core feature is a multi-agent autonomous video creation system:

```
User prompt → DirectorAgent → PlanningAgent → GenerationAgent → EditingAgent → ReviewAgent
                (Show Bible,    (Shot-level     (Parallel media   (Multi-track    (QA scoring,
                 3-act struct)   breakdowns)     generation)       timeline)       gate ≥80)
```

**Orchestration** (`agents/orchestrator.py`): Manages pipeline lifecycle, persists state to `agent_sessions` table, enqueues ARQ jobs, supports pause/resume for user Q&A.

**Specialized Agents** (`agents/specialized_agents.py`): CutAgent (pacing), AudioAgent (mixing/ducking), MotionAgent (zoom/pan), CaptionAgent (text overlays), EffectsAgent (transitions).

### Multi-Track Timeline Layout

The EditingAgent assembles assets onto 6 tracks:
- **V1**: Primary footage, **V2**: B-roll/overlay, **V3**: Text/graphics
- **A1**: Dialogue/voiceover, **A2**: SFX, **A3**: Music/score

### Background Jobs

`app/worker.py` defines ARQ job functions for all long-running tasks. ARQ uses Redis as its broker. Key jobs: `process_movie_director`, `process_movie_scene`, `process_movie_assembly`, `process_movie_review`, `process_render_job`, `process_ai_job`.

### AI Providers

All AI is cloud-API-based (no local models):
- **LLM**: Claude (Anthropic), GPT (OpenAI), Gemini (Google) — in `app/ai/providers/`
- **Video**: Replicate (Minimax, WAN), Google Veo, OpenAI Sora — in `app/services/ai_video/`
- **Voice**: ElevenLabs TTS
- **Transcription**: Replicate Whisper
- **Embeddings**: Pinecone (character consistency)

### Key Services

- `services/style_profiles.py` — Editing presets per content type (reel, youtube, podcast, documentary, corporate, cinematic)
- `services/pacing_engine.py` — Tension/energy curves and content-appropriate pacing
- `services/cost_estimator.py` — Estimates API costs before pipeline execution
- `services/storage_service.py` — Supabase Storage upload/download
- `services/generation_cache.py` — Redis-backed dedup for identical generation prompts

### Database

Async SQLAlchemy with asyncpg. Models in `app/models.py`. Key tables: `User`, `Project`, `MediaAsset`, `RenderJob`, `AIJob`, `AgentSession`, `Character`, `AIChatSession`, `AIChatMessage`.

### API Endpoints

| Prefix | Purpose |
|--------|---------|
| `/api/agent/` | Agentic pipeline (execute, status, answer, approve, regenerate) |
| `/api/projects/` | Project CRUD |
| `/api/media/` | Media asset upload/metadata |
| `/api/ai/video/` | Video/image generation, TTS, style transfer |
| `/api/auto-edit/` | Auto-editing (silence removal, captions, shorts, reframe) |
| `/api/render/` | Export/render job management |
| `/api/ai/chat/` | AI chat interface |
| `/api/sounds/` | Pixabay sound search |
| `/ws/projects/{id}` | Real-time collaboration WebSocket |

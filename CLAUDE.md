# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Grace Studio is a closed-source, agentic video editing platform for web, desktop, and mobile. The main application is a Next.js 16 web app with a timeline-based editor. Database is hosted on Supabase (managed PostgreSQL).

## Monorepo Structure

- **Package manager**: Bun 1.2.18
- **Build orchestration**: Turborepo
- **Workspaces**: `apps/*`, `packages/*`
  - `apps/web/` — Main Next.js web application (the editor)
  - `packages/env/` — Environment variable validation (Zod schemas)
  - `packages/ui/` — Shared UI components and icon library

## Common Commands

```bash
# Development
bun install                  # Install dependencies
bun dev:web                  # Start dev server (Next.js with Turbopack)
docker compose up -d redis serverless-redis-http  # Start Redis (DB is on Supabase)

# Linting & Formatting (Biome)
bun lint:web                 # Lint check
bun lint:web:fix             # Lint with auto-fix
cd apps/web && bun run lint      # Lint from web app directory
cd apps/web && bun run format    # Format code

# Building
bun build:web                # Production build

# Database (run from apps/web/)
cd apps/web
bun run db:generate          # Generate Drizzle migrations
bun run db:migrate           # Run migrations
bun run db:push:local        # Push schema to local DB

# Testing (bun:test — not Jest/Vitest)
bun test                     # Run all tests
bun test <file>              # Run a single test file
```

## Code Style

- **Biome** for linting and formatting (not ESLint/Prettier), configured via Ultracite ruleset
- Tab indentation, 80-char line width, double quotes
- No TypeScript enums — use `as const` objects
- No `any` type
- Use `for...of` instead of `Array.forEach`
- Use `.flatMap()` instead of `.map().flat()`
- Always destructure props objects: `function foo({ prop }: { prop: string })` not `function foo(prop: string)`
- Never abbreviate variable names: `event` not `e`, `element` not `el`
- Use `import type` / `export type` for type-only imports/exports
- Don't use `@ts-ignore`
- Comments should explain WHY, not WHAT — avoid AI-style comments that narrate the code
- Accessibility enforced: meaningful alt text, proper ARIA roles, semantic elements over role attributes, `type` on buttons, keyboard handlers alongside mouse handlers

## Architecture

### Core Editor System

The editor uses a **singleton EditorCore** (`src/core/index.ts`) with specialized managers:

```
EditorCore (singleton)
├── playback: PlaybackManager
├── timeline: TimelineManager
├── scene: SceneManager
├── project: ProjectManager
├── media: MediaManager
└── renderer: RendererManager
```

**In React components**, always use the `useEditor()` hook (subscribes to state changes and re-renders automatically):
```typescript
const editor = useEditor();
editor.timeline.addTrack({ type: "media" });
```

**Outside React**, use `EditorCore.getInstance()` directly.

### Actions System

Actions are user-triggered operations. Single source of truth: `src/lib/actions/definitions.ts`.

To add a new action:
1. Define it in `ACTIONS` in `src/lib/actions/definitions.ts`
2. Add handler in `src/hooks/actions/use-editor-actions.ts`

In components, use `invokeAction("action-name")` — don't call `editor.xxx()` directly for user-triggered operations (bypasses UX layer: toasts, validation).

### Commands System (Undo/Redo)

Commands live in `src/lib/commands/` organized by domain. Each extends `Command` from `src/lib/commands/base-command` with `execute()` and `undo()` methods.

Actions = "what triggered this", Commands = "how to do it (and undo it)".

### State Management

- **Zustand** stores in `src/stores/` for client state (timeline UI, panels, AI chat, keybindings, etc.)
- **Drizzle ORM** with PostgreSQL for server state
- Schema: `src/lib/db/schema.ts` (users, sessions, accounts, AI chat sessions/messages — all with RLS)

### Key Directories (apps/web/src/)

- `core/` — EditorCore singleton and manager classes
- `lib/` — Domain logic specific to this app
- `utils/` — Generic helpers (could be copy-pasted to any project)
- `lib/actions/` — Action definitions and registry
- `lib/commands/` — Undo/redo command implementations
- `hooks/actions/` — React hooks for action handlers
- `services/` — Service classes (renderer, storage, transcription, video-cache)
- `stores/` — Zustand state stores
- `types/` — TypeScript type definitions

### Authentication

Better Auth with email/password, database-backed sessions, Redis rate limiting via Upstash.

### API Routes (Next.js — apps/web)

- `/api/auth/[...all]` — Authentication (Better Auth)
- `/api/ai/*` — AI features (chat with Claude/OpenAI/Gemini, music, voice, stock media)
- `/api/sounds/search` — Pixabay sound/music search
- `/api/render-motion` — Remotion video rendering endpoint

### Backend API (FastAPI — apps/api)

Python FastAPI backend with async SQLAlchemy, managed separately from the Next.js app.

```
apps/api/app/
├── agents/       — AI agents (director, editing, generation, planning, review)
├── routers/      — API route handlers
├── schemas/      — Pydantic request/response models
├── services/     — Business logic (pacing engine, style profiles, text sizing)
├── ai/           — AI provider integrations
├── models.py     — Database models
└── worker.py     — Background jobs (ARQ task queue with Redis)
```

- **Linting**: Ruff (100-char line length, Python 3.12 target)
- **Testing**: pytest + pytest-asyncio
- **API keys**: stored in `apps/api/.env`

## Contribution Focus Areas

**Work on**: Timeline functionality, project management, performance, bug fixes, UI/UX improvements.

**Avoid for now**: Preview panel enhancements (fonts, stickers, effects) and export functionality — these are being refactored to a binary rendering approach.

## File Organization

One file, one responsibility. Extract shared concerns into focused utility files. Split files >500 lines.

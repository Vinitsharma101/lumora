# GraceCut — Project Documentation

## 1. What is GraceCut?

GraceCut is a closed-source, agentic video editing platform built for web, desktop, and mobile. It features a timeline-based editor with AI-powered editing capabilities, allowing users to create, edit, and export professional videos directly in the browser.

Key highlights:
- Browser-based timeline video editor with multi-track support
- AI chat assistant (Claude, OpenAI, Gemini) that can autonomously edit videos via 50+ tools
- Real-time canvas preview with effects, transitions, and transform controls
- Motion graphics templates powered by Remotion
- AI-powered media generation (voiceover, music, images, video)
- Full undo/redo command history
- Auto-save with IndexedDB + OPFS browser storage
- Stock media integration (Pexels, Pixabay)

---

## 2. Tech Stack Overview

| Layer | Technologies |
|-------|-------------|
| **Runtime & Package Manager** | Bun 1.2.18 |
| **Monorepo Orchestration** | Turborepo 2.7.5 |
| **Framework** | Next.js 16.1.3 (App Router, Turbopack) |
| **Language** | TypeScript 5.8 |
| **UI Library** | React 19.2.4 |
| **Styling** | Tailwind CSS 4.1.11, CSS variables for theming |
| **UI Components** | Radix UI primitives, shadcn/ui (60+ components) |
| **Icons** | Lucide React, Hugeicons |
| **State Management** | Zustand 5.0.2 (client UI state) |
| **Database** | PostgreSQL on Supabase (managed) |
| **ORM** | Drizzle ORM |
| **Authentication** | Better Auth (email/password, DB-backed sessions) |
| **Rate Limiting** | Redis + Upstash (serverless Redis HTTP) |
| **Video Rendering** | Remotion 4.0.434 (motion graphics & export) |
| **Media Processing** | FFmpeg.wasm, mediabunny, WaveSurfer.js |
| **Client-Side ML** | @huggingface/transformers |
| **Backend API** | FastAPI (Python) for AI/rendering services |
| **Job Queue** | arq (Python async task queue) |
| **Cloud Storage** | Supabase Storage, Cloudflare R2 |
| **Browser Storage** | IndexedDB + OPFS (Origin Private File System) |
| **Linting & Formatting** | Biome (not ESLint/Prettier) |
| **Forms** | React Hook Form + Zod validation |
| **Containerization** | Docker Compose |

---

## 3. Monorepo Structure

```
gracecut/
├── apps/
│   └── web/                    # Main Next.js application (the editor)
├── packages/
│   ├── env/                    # Environment variable validation (Zod schemas)
│   └── ui/                     # Shared UI components and icon library
├── docker-compose.yml          # Redis, FastAPI, worker, web
├── turbo.json                  # Turborepo task config
├── biome.json                  # Linting & formatting rules
└── package.json                # Workspace root
```

### Workspaces
- **`apps/web`** (`@gracecut/web`) — The main Next.js 16 editor application
- **`packages/env`** (`@gracecut/env`) — Zod-validated environment variables for web and tools
- **`packages/ui`** (`@gracecut/ui`) — Shared icon library (Hugeicons, brand SVGs)

---

## 4. Application Architecture

### 4.1 Directory Layout (`apps/web/src/`)

```
src/
├── app/                # Next.js App Router (pages, layouts, API routes)
├── components/         # React components
│   ├── editor/         # Editor UI (panels, dialogs, header)
│   ├── ui/             # 60+ Radix/shadcn base components
│   ├── landing/        # Landing page components
│   ├── movie/          # Movie playback components
│   └── providers/      # EditorProvider context
├── core/               # EditorCore singleton + 10 manager classes
│   ├── index.ts        # EditorCore class
│   └── managers/       # PlaybackManager, TimelineManager, etc.
├── hooks/              # 30+ custom React hooks
│   ├── actions/        # Action handler hooks
│   └── timeline/       # Timeline interaction hooks
├── lib/                # Domain-specific logic
│   ├── actions/        # Action definitions & registry
│   ├── ai/             # AI system prompt, tools, streaming
│   ├── commands/       # Undo/redo command classes
│   ├── db/             # Drizzle schema & connection
│   ├── auth/           # Better Auth client config
│   ├── effects/        # Effect & transition engines
│   ├── media/          # Media processing utilities
│   ├── remotion/       # Remotion motion graphics compositions
│   ├── scenes/         # Scene management logic
│   └── timeline/       # Timeline utilities (snap, zoom, drag)
├── services/           # Service singletons
│   ├── renderer/       # Canvas rendering pipeline + scene graph
│   ├── storage/        # IndexedDB + OPFS persistence
│   ├── transcription/  # Speech-to-text (Cloudflare R2 + Modal)
│   └── video-cache/    # Browser video frame caching
├── stores/             # Zustand state stores (12 stores)
├── types/              # TypeScript type definitions
└── utils/              # Generic reusable helpers
```

### 4.2 Pages & Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/projects` | Project gallery / selector |
| `/editor/[project_id]` | Main editor (timeline, preview, properties, assets) |
| `/movie/[project_id]` | Movie view / export |
| `/blog/[slug]` | Blog posts |
| `/privacy`, `/terms`, `/roadmap` | Static pages |
| `/api/render-motion` | Server-side Remotion rendering (POST) |

---

## 5. Core Editor System

### 5.1 EditorCore Singleton

The heart of the application. A singleton class that orchestrates all editing operations through specialized managers:

```
EditorCore (singleton)
├── playback: PlaybackManager      # Play/pause/seek/volume
├── timeline: TimelineManager      # Tracks, elements, split, trim
├── scenes: ScenesManager          # Multi-scene, bookmarks
├── project: ProjectManager        # Create/load/save projects
├── media: MediaManager            # Asset management
├── renderer: RendererManager      # Render tree, export
├── command: CommandManager        # Undo/redo history
├── save: SaveManager              # Debounced auto-save (800ms)
├── audio: AudioManager            # Real-time audio playback
└── selection: SelectionManager    # Selected element state
```

**Access in React:**
```typescript
const editor = useEditor(); // subscribes via useSyncExternalStore
editor.timeline.addTrack({ type: "media" });
```

**Access outside React:**
```typescript
EditorCore.getInstance().playback.play();
```

### 5.2 Manager Details

#### PlaybackManager
- State: `isPlaying`, `currentTime`, `volume`, `muted`, `isScrubbing`
- Methods: `play()`, `pause()`, `toggle()`, `seek({ time })`, `setVolume()`, `mute()`, `unmute()`
- Uses `requestAnimationFrame` for smooth playback timing
- Dispatches window events (`playback-seek`, `playback-update`)

#### TimelineManager
- Wraps all track/element operations through commands
- Track ops: `addTrack()`, `removeTrack()`, `toggleTrackMute()`, `toggleTrackVisibility()`
- Element ops: `insertElement()`, `updateElement()`, `deleteElements()`, `duplicateElements()`
- Trim/split: `updateElementTrim()`, `splitElements()`
- Non-destructive preview: `previewElements()`, `commitPreview()`, `discardPreview()`

#### ScenesManager
- State: `active` (current scene), `list` (all scenes)
- Methods: `createScene()`, `deleteScene()`, `renameScene()`, `switchToScene()`
- Bookmark system: `toggleBookmark()`, `removeBookmark()`, `updateBookmark()`
- Every scene has: `id`, `name`, `isMain`, `tracks[]`, `bookmarks[]`

#### ProjectManager
- State: `active` (TProject), `savedProjects` (metadata list)
- `createNewProject({ name })` — creates default scene, returns projectId
- `loadProject({ id })` — loads from storage, initializes scenes & media
- `saveCurrentProject()` — triggered by SaveManager debounce
- Thumbnail generation on load/exit
- Migration support (versioned schema updates)

#### MediaManager
- Manages media assets (video, audio, image files)
- `addMediaAsset()` — saves to storage, maintains asset list
- `removeMediaAsset()` — revokes Object URLs, deletes referencing elements
- Cleanup: revokes blob URLs, clears video cache

#### RendererManager
- Holds render tree (RootNode) for preview
- `saveSnapshot()` — renders current frame to PNG
- `exportProject({ options })` — orchestrates SceneExporter for video export

#### CommandManager
- Implements undo/redo with dual history stacks
- `execute({ command })` — runs command, pushes to undo stack, clears redo
- `undo()`, `redo()`, `canUndo()`, `canRedo()`

#### SaveManager
- Debounced auto-save (800ms default)
- Subscribes to `scenes` and `timeline` change events
- `markDirty()` queues save, `flush()` saves immediately
- `pause()` / `resume()` during project loading

#### AudioManager
- Real-time audio playback synchronized with PlaybackManager
- Uses mediabunny (AudioBufferSink, Input) for streaming
- Lookahead: 2 seconds, scheduler interval: 500ms

#### SelectionManager
- Simple state holder: `getSelectedElements()`, `setSelectedElements()`, `clearSelection()`

---

## 6. Data Model

### 6.1 Timeline Types

```typescript
type TrackType = "video" | "text" | "audio" | "sticker";

interface TScene {
  id: string;
  name: string;
  isMain: boolean;
  tracks: TimelineTrack[];
  bookmarks: Bookmark[];
}

interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  elements: TimelineElement[];
  muted: boolean;
  hidden: boolean;
}

// Element types: VideoElement, ImageElement, TextElement, AudioElement, StickerElement
// Each has: id, name, startTime, duration, trimStart, trimEnd, transform, effects, transitions
```

### 6.2 Project Types

```typescript
interface TProject {
  metadata: TProjectMetadata;      // id, name, thumbnail, duration, dates
  scenes: TScene[];
  currentSceneId: string;
  settings: TProjectSettings;      // fps, canvasSize, background
  version: number;
}

interface TProjectSettings {
  fps: number;
  canvasSize: { width: number; height: number };
  background: TBackground;         // color | blur
}
```

### 6.3 Database Schema (Drizzle + Supabase PostgreSQL)

| Table | Purpose |
|-------|---------|
| `users` | User accounts (Better Auth) |
| `sessions` | Database-backed sessions |
| `accounts` | OAuth & password auth providers |
| `aiChatSessions` | AI chat conversation tracking (userId, projectId, provider) |
| `aiChatMessages` | Chat message history (role, content, toolCalls, toolResults) |
| `verifications` | Email verification codes |

All tables have Row-Level Security (RLS) enabled.

---

## 7. Commands System (Undo/Redo)

Every user operation is wrapped in a `Command` with `execute()` and `undo()` methods:

```
lib/commands/
├── base-command.ts         # Abstract Command class
├── batch-command.ts        # Groups multiple commands as single undo entry
├── preview-tracker.ts      # Captures state before preview for commit/discard
├── timeline/
│   ├── track/              # AddTrack, RemoveTrack, ToggleMute, ToggleVisibility
│   └── element/            # Insert, Update, Delete, Duplicate, Split, Trim
├── scene/                  # Create, Delete, Rename, Bookmark operations
├── project/                # UpdateProjectSettings
└── media/                  # AddMediaAsset, RemoveMediaAsset
```

**Pattern:** Actions (what triggered it) -> Commands (how to do it and undo it)

---

## 8. Actions System

Single source of truth: `src/lib/actions/definitions.ts` — 47 user-triggered operations:

| Category | Actions | Default Shortcuts |
|----------|---------|-------------------|
| **Playback** | toggle-play, stop-playback | `Space`/`K` |
| **Seeking** | seek-forward/backward, jump-forward/backward | `J`/`L`, `Shift+Left`/`Right` |
| **Navigation** | frame-step, goto-start/end | `Left`/`Right`, `Home`/`End` |
| **Editing** | split, split-left, split-right | `S`, `Q`, `W` |
| **Selection** | delete, copy, paste, duplicate, select-all | `Del`, `Ctrl+C/V/D/A` |
| **History** | undo, redo | `Ctrl+Z`, `Ctrl+Shift+Z` |
| **Controls** | toggle-snapping, toggle-ai-panel | `N`, `Ctrl+Shift+A` |
| **AI** | ask-ai-about-selection | — |

**Flow:** Keyboard event -> `useKeybindingsListener()` -> `invokeAction()` -> registered `useActionHandler()` -> EditorCore operation

---

## 9. Rendering Pipeline

### 9.1 Scene Graph

The renderer converts timeline data into a node tree:

```
RootNode (canvas background)
├── VideoNode (with trim, seek, caching)
├── ImageNode (contain-fit scaling)
├── TextNode (canvas text rendering)
├── StickerNode (emoji/icon)
├── ColorNode (solid fill)
└── BlurBackgroundNode (blur effect)
```

All visual nodes support:
- **Effects:** blur, pixelate, grayscale, color grading, cinematic LUTs (blockbuster, indie, noir, sci-fi), golden hour
- **Transitions:** fade, slide, scale, rotate, spin, barrel-roll, zoom, flash, glitch, bounce
- **Easing:** linear, easeIn/Out, easeInOutQuad, easeInOutCubic
- **Transform:** position, scale, rotation, opacity, blend mode

### 9.2 Rendering Flow

```
Timeline Data
  -> SceneBuilder.buildScene()     # Timeline tracks -> node tree
    -> CanvasRenderer.render()     # Node tree -> canvas pixels (OffscreenCanvas or HTMLCanvasElement)
      -> Each node renders at time T
        -> Effects applied via canvas filter strings
        -> Transitions computed per frame
```

### 9.3 Export Pipeline

```
RendererManager.exportProject()
  -> SceneBuilder builds scene graph
  -> TimelineAudioBuffer merges audio (if includeAudio)
  -> SceneExporter encodes to video via Remotion
  -> Returns ArrayBuffer for download
```

### 9.4 Remotion Motion Graphics

Pre-built animation templates:
- **LowerThird** — name/title overlay
- **TitleCard** — intro slide
- **SubscribeCTA** — call-to-action button
- **Countdown** — numeric countdown
- **TextReveal** — animated text reveal

Server-side rendering via `/api/render-motion` with webpack bundle caching.

---

## 10. State Management

### 10.1 Zustand Stores (Client UI State)

| Store | Purpose | Persisted? |
|-------|---------|------------|
| `useEditorStore` | `isInitializing`, `isPanelsReady`, `canvasPresets` | No |
| `useTimelineStore` | `snappingEnabled`, `rippleEditingEnabled`, `clipboard` | Partial |
| `usePanelStore` | Panel sizes (tools, preview, properties, timeline) | Yes (v3) |
| `useAIChatStore` | Chat messages, provider, streaming state, file uploads | Partial |
| `useKeybindingsStore` | Custom keyboard shortcut overrides | Yes (v4) |
| `usePreviewStore` | Layout guides, overlay visibility | Yes (v2) |
| `useSoundsStore` | Sound search library cache | No |
| `useStickersStore` | Sticker library cache | No |
| `useMovieStore` | Movie creation wizard | Yes |
| `useAssetsPanelStore` | Assets panel UI state | Yes |

Zustand stores use `persist` middleware with version tracking and migration functions.

### 10.2 State Separation

- **EditorCore managers** = core editing state (timeline, scenes, playback, media)
- **Zustand stores** = UI state only (panel sizes, keybindings, chat messages)
- **Drizzle/Supabase** = server-persisted state (users, sessions, AI chat history)
- **IndexedDB + OPFS** = browser-persisted state (projects, media files)

---

## 11. AI System

### 11.1 Overview

GraceCut features an AI chat assistant that can autonomously edit videos through 50+ tools. It supports three providers:
- **Claude** (Anthropic)
- **GPT** (OpenAI)
- **Gemini** (Google)

### 11.2 Architecture

```
lib/ai/
├── system-prompt.ts      # 119-line system prompt with cinematography reference
├── context.ts            # Serializes editor state for AI context
├── stream-consumer.ts    # SSE stream parsing
├── tools/
│   ├── definitions.ts    # 50+ tool definitions (JSON schema)
│   └── executor.ts       # Tool execution logic (978 lines)
└── providers/
    └── types.ts          # Provider type definitions
```

### 11.3 AI Tool Categories

| Category | Tools | Backend |
|----------|-------|---------|
| **Timeline Inspection** | get_timeline_state, get_project_settings, get_media_assets | Local |
| **Text & Captions** | add_text_caption, add_multiple_captions (full styling) | Local |
| **Element Manipulation** | update_element, delete_elements, split_element, move_element | Local |
| **Project Settings** | set_canvas_size, set_background, seek_to_time | Local |
| **Voice Generation** | generate_voiceover (30+ ElevenLabs voices) | FastAPI |
| **Music Generation** | generate_music (Suno AI) | FastAPI |
| **Stock Media** | search_stock_video/image (Pexels/Pixabay) | FastAPI |
| **Image Generation** | generate_image (FLUX AI via Replicate) | FastAPI |
| **Video Generation** | generate_video (Google Veo, Replicate, OpenAI Sora) | FastAPI |
| **Media Understanding** | understand_media (analyze images/videos/audio) | FastAPI |
| **Motion Graphics** | add_motion_graphic, list_motion_templates | Local + API |
| **Autonomous Agent** | start_agent_session, answer_agent_question, get_agent_status | FastAPI |

### 11.4 AI Chat Flow

```
User types message in AIChatInput
  -> useAIChat() builds conversation + editor context
    -> POST to FastAPI /api/ai/chat (streamed SSE)
      -> AI responds with text + tool calls
        -> executor.ts runs tools on EditorCore
          -> Results streamed back to AI for follow-up
            -> Displayed in AIChatMessages component
```

---

## 12. Authentication & Security

- **Framework:** Better Auth v1.4.15
- **Methods:** Email/password sign-up and sign-in
- **Sessions:** Database-backed (PostgreSQL), not JWT-only
- **Rate Limiting:** Redis via Upstash (serverless Redis HTTP adapter)
- **Token Storage:** `gracecut_token` in localStorage
- **API Auth:** Bearer token in Authorization header via `apiFetch()` wrapper
- **RLS:** All database tables have Row-Level Security enabled

---

## 13. Storage & Persistence

### 13.1 Browser Storage (Projects & Media)

| Adapter | What It Stores |
|---------|---------------|
| **IndexedDB** | Project metadata, media metadata, saved sounds, settings |
| **OPFS** (Origin Private File System) | Binary media files (video, audio, images) |

The storage service includes a migration system (v0 through v7) with progress tracking.

### 13.2 Cloud Storage

| Service | Purpose |
|---------|---------|
| **Supabase** | PostgreSQL database, file storage |
| **Cloudflare R2** | Transcription file storage |

---

## 14. Editor UI Layout

The editor is a multi-panel layout:

```
+-------------------------------------------------------------+
|                     Editor Header                           |
+----------+----------------------+----------+----------------+
|          |                      |          |                |
|  Assets  |      Preview         |Properties|   AI Chat      |
|  Panel   |      Canvas          |  Panel   |   Panel        |
|          |                      |          |   (collapsible)|
|  - Media |  - Canvas renderer   |  - Video |                |
|  - Text  |  - Transform handles |  - Audio |                |
|  - Audio |  - Playback controls |  - Text  |                |
|  - Stock |  - Context menu      |  - Trans |                |
|          |                      |  - Blend |                |
+----------+----------------------+----------+----------------+
|                      Timeline Panel                         |
|  - Track headers  |  Ruler  |  Playhead  |  Bookmarks       |
|  - Track elements |  Snap guides  |  Selection box          |
+-------------------------------------------------------------+
```

All panels are resizable via Radix resizable panels. Sizes are persisted in Zustand.

---

## 15. Docker Compose Services

| Service | Port | Technology | Purpose |
|---------|------|------------|---------|
| **web** | 3100 | Next.js 16 | Frontend application |
| **api** | 8000 | FastAPI (Python) | AI, rendering, media APIs |
| **worker** | — | arq (Python) | Async job queue (rendering, generation) |
| **redis** | 6379 | Redis | Rate limiting, caching |
| **serverless-redis-http** | 8079 | HTTP wrapper | Upstash-compatible Redis HTTP API |

Database (PostgreSQL) is hosted externally on Supabase.

---

## 16. Key Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...              # Supabase PostgreSQL

# Auth
BETTER_AUTH_SECRET=...

# AI Providers
ANTHROPIC_API_KEY=...                      # Claude
OPENAI_API_KEY=...                         # GPT
GOOGLE_AI_API_KEY=...                      # Gemini

# Media Generation
ELEVENLABS_API_KEY=...                     # Voice/TTS
SUNO_API_KEY=...                           # Music generation
REPLICATE_API_TOKEN=...                    # Image generation (FLUX)

# Stock Media
PEXELS_API_KEY=...
PIXABAY_API_KEY=...

# Cloud Storage
SUPABASE_URL=..., SUPABASE_ANON_KEY=...
CLOUDFLARE_ACCOUNT_ID=..., R2_*=...

# URLs
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 17. End-to-End Data Flows

### 17.1 Adding Media to Timeline

```
User uploads file in Assets Panel
  -> useFileUpload() processes file
    -> processMediaAssets() extracts metadata + thumbnail
      -> editor.media.addMediaAsset() (via AddMediaAssetCommand)
        -> storageService.saveMediaAsset() -> IndexedDB + OPFS
          -> User drags asset to timeline
            -> editor.timeline.insertElement() (via InsertElementCommand)
              -> SceneBuilder rebuilds render tree
                -> CanvasRenderer re-renders preview
                  -> SaveManager.markDirty() -> auto-save (800ms debounce)
```

### 17.2 Playing Video

```
User presses Space
  -> invokeAction("toggle-play")
    -> editor.playback.play()
      -> PlaybackManager starts RAF loop
        -> editor.audio.startPlayback() syncs audio
          -> useRafLoop() triggers on each frame
            -> SceneBuilder.buildScene() at currentTime
              -> CanvasRenderer.render() draws frame
                -> Canvas updates on screen
```

### 17.3 AI-Assisted Edit

```
User types "Add a title at the beginning"
  -> useAIChat() sends to FastAPI with editor context
    -> AI returns tool call: add_text_caption(...)
      -> executor.ts runs on EditorCore
        -> InsertElementCommand executed
          -> Timeline updates, preview re-renders
            -> Tool result sent back to AI
              -> AI confirms action to user
```

### 17.4 Exporting Video

```
User clicks Export
  -> editor.renderer.exportProject({ options })
    -> SceneBuilder builds full scene graph
      -> TimelineAudioBuffer merges all audio tracks
        -> SceneExporter encodes via Remotion (h264)
          -> Returns ArrayBuffer
            -> Browser triggers file download (.mp4)
```

---

## 18. Common Development Commands

```bash
# Install & Run
bun install                                    # Install all dependencies
bun dev:web                                    # Start Next.js dev server (Turbopack)
docker compose up -d redis serverless-redis-http  # Start Redis services

# Code Quality (Biome)
bun lint:web                                   # Lint check
bun lint:web:fix                               # Lint with auto-fix
cd apps/web && bun run format                  # Format code

# Build
bun build:web                                  # Production build

# Database (from apps/web/)
cd apps/web
bun run db:generate                            # Generate Drizzle migrations
bun run db:migrate                             # Run migrations
bun run db:push:local                          # Push schema to local DB

# Testing
bun test                                       # Run all tests
bun test <file>                                # Run single test file
```

---

## 19. Code Conventions

- **Biome** for linting and formatting (not ESLint/Prettier)
- Tab indentation, 80-char line width, double quotes
- No TypeScript enums — use `as const` objects
- No `any` type, no `@ts-ignore`
- Use `for...of` instead of `Array.forEach`
- Use `import type` / `export type` for type-only imports
- Always destructure props: `function Foo({ bar }: { bar: string })`
- Never abbreviate: `event` not `e`, `element` not `el`
- Comments explain WHY, not WHAT
- One file, one responsibility; split files >500 lines

# API Communication Setup Guide

This document describes how the Grace Studio frontend (Next.js) and backend (FastAPI) communicate.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js Frontend                      │
│                  (runs at :3000)                        │
│  - No database connections                             │
│  - No server-side secrets                              │
│  - Only public environment variables (NEXT_PUBLIC_*)   │
│  - Uses apiFetch() for all backend calls               │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP Requests
                       │ (with JWT tokens)
                       ↓
┌─────────────────────────────────────────────────────────┐
│                  FastAPI Backend                        │
│                   (runs at :8000)                       │
│  - Direct database access                              │
│  - AI/ML integrations                                  │
│  - Authentication & authorization                      │
│  - External API integrations                           │
└─────────────────────────────────────────────────────────┘
```

## Frontend Setup

### 1. Environment Variables (.env.local)

The frontend should ONLY have these variables:

```dotenv
# Public variables (visible in bundle)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional client-side services
NEXT_PUBLIC_MARBLE_API_URL=https://api.marblecms.com
```

**⚠️ DO NOT include:**

- DATABASE_URL
- Secret API keys
- Cloud storage credentials
- JWT secrets
- Any server-side configuration

### 2. API Communication (apiFetch)

All API calls use the `apiFetch()` wrapper in `src/lib/api-client.ts`:

```typescript
import { apiFetch } from "@/lib/api-client";

// Automatic features:
// - Prepends NEXT_PUBLIC_API_URL
// - Attaches JWT token from localStorage
// - Handles CORS properly

const response = await apiFetch("/api/auth/sign-up", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "user@example.com", password: "..." }),
});

const data = await response.json();
```

### 3. Testing Connection

Use the provided test utility to verify frontend-backend communication:

```typescript
// In browser console:
import { testAPIConnection } from "@/utils/api-test";
await testAPIConnection();
```

Or make a specific test call:

```typescript
import { makeTestAPICall } from "@/utils/api-test";
await makeTestAPICall("/api/health");
```

## Backend Setup

### 1. Environment Variables (.env)

Located in `apps/api/.env`:

```dotenv
# Database (required for operations)
DATABASE_URL=postgresql+asyncpg://grace-studio:grace-studio@localhost:5432/grace-studio

# Authentication
JWT_SECRET=your-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=168

# Redis (for caching/sessions)
REDIS_URL=redis://localhost:6379

# CORS (frontend URLs allowed to make requests)
CORS_ORIGINS=http://localhost:3000,http://localhost:3100

# API Keys (optional, features disabled without these)
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=...
PIXABAY_API_KEY=...
```

### 2. API Routes

Available endpoints in `apps/api/app/routers/`:

- **Health Check** → `GET /api/health`
- **Authentication** → `/api/auth/*`
  - `POST /api/auth/sign-up`
  - `POST /api/auth/sign-in`
  - `GET /api/auth/me`
- **AI Features** → `/api/ai/*`
  - Chat, music generation, voice synthesis, stock media, etc.
- **Sessions** → `/api/sessions/*`
- **Sounds** → `/api/sounds/search`

### 3. CORS Configuration

CORS is automatically configured in FastAPI via `CORS_ORIGINS` env var.

**For development:**

```dotenv
CORS_ORIGINS=http://localhost:3000
```

**For production:**

```dotenv
CORS_ORIGINS=https://app.gracestudio.app,https://www.gracestudio.app
```

## Starting the Services

### 1. Start Docker Services

```bash
docker compose up -d db redis serverless-redis-http
```

This starts:

- PostgreSQL (port 5432)
- Redis (port 6379)
- Redis HTTP proxy (port 8079)

### 2. Start FastAPI Backend

```bash
cd apps/api
python -m uvicorn app.main:app --reload --port 8000
```

Or using Docker:

```bash
docker compose up api
```

### 3. Start Next.js Frontend

```bash
bun dev:web
```

Or in a new terminal:

```bash
cd apps/web && bun dev
```

The frontend will be available at `http://localhost:3000`
The backend will be available at `http://localhost:8000`

## Troubleshooting

### "Cannot connect to API"

1. Check that FastAPI is running:

   ```bash
   curl http://localhost:8000/api/health
   ```

2. Verify `NEXT_PUBLIC_API_URL` in frontend `.env.local`:

   ```dotenv
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

3. Check CORS settings in `apps/api/.env`:
   ```dotenv
   CORS_ORIGINS=http://localhost:3000
   ```

### "CORS error"

1. Ensure backend is running
2. Check CORS_ORIGINS includes your frontend URL
3. Verify the request is using `apiFetch()`, not raw `fetch()`

### "Database connection error"

1. Verify PostgreSQL is running: `docker compose ps`
2. Check `DATABASE_URL` in `apps/api/.env`
3. Run migrations: `cd apps/api && alembic upgrade head`

### Authentication issues

1. Check JWT_SECRET is set in `apps/api/.env`
2. Verify token is being stored: Open DevTools → Application → Local Storage → `grace-studio_token`
3. Test token in Authorization header

## Frontend Code Organization

✅ **Should be in frontend:**

- React components
- Client-side state (Zustand stores)
- UI logic and styling
- Browser APIs (IndexedDB, localStorage)
- Calls to backend via `apiFetch()`

❌ **Should NOT be in frontend:**

- Database queries
- Server-side authentication logic
- Secret API keys
- File uploads directly to storage (should go through backend)
- Complex business logic requiring secrets

## Security Best Practices

1. **Never commit secrets** - Use `.env` and `.env.local` (in .gitignore)
2. **Public only** - Only variables with `NEXT_PUBLIC_` prefix are visible to browsers
3. **Token storage** - Keep JWT tokens in httpOnly cookies or secure storage
4. **HTTPS in production** - Always use HTTPS and set Secure flag on cookies
5. **CORS validation** - Always validate origin serverside (already configured)

## Additional Resources

- [Frontend API Client](src/lib/api-client.ts)
- [Backend Config](../api/app/config.py)
- [FastAPI Docs](http://localhost:8000/docs) - Available when backend is running
- [Docker Compose](../../docker-compose.yml)

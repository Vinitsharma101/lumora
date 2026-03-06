# API Communication Verification Checklist

This checklist helps you verify that the Next.js frontend and FastAPI backend are properly configured for communication.

## ✅ Frontend Setup

- [ ] **Environment Variables**
  - [ ] `.env.local` exists in `apps/web/`
  - [ ] `NEXT_PUBLIC_API_URL=http://localhost:8000`
  - [ ] No backend secrets in `.env.local` (no DATABASE_URL, JWT_SECRET, AWS keys, etc.)
  - [ ] Keys referenced: [.env.local](.env.local)

- [ ] **API Client Usage**
  - [ ] All API calls use `apiFetch()` from `src/lib/api-client.ts`
  - [ ] No raw `fetch()` calls to backend endpoints
  - [ ] JWT token is automatically attached to requests
  - [ ] Reference: [api-client.ts](src/lib/api-client.ts)

- [ ] **Code Organization**
  - [ ] No database imports (no `drizzle-orm` operations)
  - [ ] No "use server" directives
  - [ ] No server-side secrets accessed
  - [ ] No direct database connection code
  - [ ] Reference: [frontend source](src/)

## ✅ Backend Setup

- [ ] **Environment Variables**
  - [ ] `.env` exists in `apps/api/`
  - [ ] `DATABASE_URL` is configured
  - [ ] `JWT_SECRET` is set (and different from default)
  - [ ] `CORS_ORIGINS` includes frontend URLs
  - [ ] AI provider keys configured (optional but recommended)
  - [ ] Reference: [.env](apps/api/.env)

- [ ] **CORS Configuration**
  - [ ] `CORSMiddleware` is configured in `main.py`
  - [ ] `CORS_ORIGINS` includes `http://localhost:3000`
  - [ ] For production, update to your domain
  - [ ] Reference: [main.py](apps/api/app/main.py)

- [ ] **API Endpoints**
  - [ ] Health check endpoint: `/api/health`
  - [ ] Auth endpoints: `/api/auth/*`
  - [ ] AI endpoints: `/api/ai/*`
  - [ ] Other routers properly imported
  - [ ] Reference: [routers/](apps/api/app/routers/)

## ✅ Docker Services

- [ ] **PostgreSQL (Supabase)**
  - [ ] Supabase project created
  - [ ] DATABASE_URL configured with Supabase connection string

- [ ] **Redis**
  - [ ] Running on port 6379
  - [ ] Command: `docker compose up -d redis`

- [ ] **Redis HTTP Proxy**
  - [ ] Running on port 8079
  - [ ] Command: `docker compose up -d serverless-redis-http`

## ✅ Services Running

- [ ] **Redis**

  ```bash
  docker compose exec redis redis-cli ping
  # Expected: PONG
  ```

- [ ] **FastAPI Backend**

  ```bash
  curl http://localhost:8000/api/health
  # Expected: {"status": "ok"}
  ```

- [ ] **Next.js Frontend** (should see "Ready in..." message)
  ```bash
  cd apps/web && npm run dev
  # Check: http://localhost:3000
  ```

## ✅ Communication Test

### Browser Console Test

1. Open browser → DevTools → Console
2. Run:
   ```javascript
   import { testAPIConnection } from "@/utils/api-test";
   await testAPIConnection();
   ```
3. Expected output: ✅ 4/4 tests passed

### Manual API Call Test

```bash
# Test health endpoint
curl -X GET http://localhost:8000/api/health

# Expected response:
# {"status": "ok"}
```

### Request Headers Test (from browser console)

```javascript
import { apiFetch } from "@/lib/api-client";

const response = await apiFetch("/api/health");
console.log(response.headers.get("access-control-allow-origin"));
// Should show: http://localhost:3000
```

## ✅ Troubleshooting

### "API Connection Refused"

- [ ] FastAPI backend is running: `docker compose up api` or `python -m uvicorn app.main:app --reload`
- [ ] Backend port is 8000
- [ ] `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local`

### "CORS Error in Browser"

- [ ] `CORS_ORIGINS=http://localhost:3000` in `apps/api/.env`
- [ ] Using `apiFetch()`, not raw `fetch()`
- [ ] Restart backend after changing CORS settings

### "401 Unauthorized"

- [ ] JWT token might be expired
- [ ] Clear localStorage: `localStorage.clear()` in console
- [ ] Re-authenticate or sign up
- [ ] Check `JWT_SECRET` matches between requests

### "404 Endpoint Not Found"

- [ ] Check endpoint path (e.g., `/api/health` not `/health`)
- [ ] Verify router is imported in `main.py`
- [ ] Check FastAPI is running: visit http://localhost:8000/docs

### "Database Connection Error"

- [ ] Supabase project is active
- [ ] Connection string correct in `apps/api/.env`
- [ ] Migrations applied via Supabase SQL editor or `cd apps/web && bun run db:push:local`

## 📚 Key Files

| File                                                             | Purpose                                   |
| ---------------------------------------------------------------- | ----------------------------------------- |
| [apps/web/.env.local](apps/web/.env.local)                       | Frontend configuration (public vars only) |
| [apps/api/.env](apps/api/.env)                                   | Backend configuration (secrets)           |
| [apps/web/src/lib/api-client.ts](apps/web/src/lib/api-client.ts) | API fetch wrapper for all requests        |
| [apps/web/src/utils/api-test.ts](apps/web/src/utils/api-test.ts) | API testing utility                       |
| [apps/api/app/main.py](apps/api/app/main.py)                     | FastAPI app setup                         |
| [docker-compose.yml](docker-compose.yml)                         | Service orchestration                     |
| [API_COMMUNICATION.md](API_COMMUNICATION.md)                     | Detailed setup guide                      |

## 🚀 Quick Start

```bash
# 1. Start Docker services (Redis only, DB is on Supabase)
docker compose up -d redis serverless-redis-http

# 2. Start FastAPI backend (Terminal 1)
cd apps/api
python -m uvicorn app.main:app --reload --port 8000

# 3. Start Next.js frontend (Terminal 2)
cd apps/web
bun dev

# 4. Test communication
# Open http://localhost:3000 in browser
# Open DevTools Console and run:
# import { testAPIConnection } from '@/utils/api-test';
# await testAPIConnection();
```

## ✨ Success Indicators

- ✅ Frontend loads at `http://localhost:3000`
- ✅ API health check succeeds: `curl http://localhost:8000/api/health`
- ✅ No CORS errors in browser console
- ✅ API calls include `Authorization: Bearer <token>` header
- ✅ Test utility shows "4/4 tests passed"

---

For more details, see [API_COMMUNICATION.md](API_COMMUNICATION.md)

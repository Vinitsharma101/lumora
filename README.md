
## Features

- Timeline-based editing
- Multi-track support
- Real-time preview
- AI chat assistant for natural language editing
- AI voice & music generation
- Auto captions with AI transcription
- Stock media search
- No watermarks or subscriptions

## Project Structure

- `apps/web/` - Main Next.js web application
- `apps/api/` - FastAPI backend (AI services, rendering, storage)
- `packages/ui/` - Shared UI components
- `packages/env/` - Environment variable validation

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/docs/installation)
- [Docker](https://docs.docker.com/get-docker/) (for Redis)
- A [Supabase](https://supabase.com) project (for PostgreSQL database)

### Setup

1. Clone the repository

2. Copy environment files:

   ```bash
   cp apps/web/.env.example apps/web/.env.local
   cp apps/api/.env.example apps/api/.env
   ```

3. Configure your Supabase DATABASE_URL in both `.env` files

4. Start Redis:

   ```bash
   docker compose up -d redis serverless-redis-http
   ```

5. Install dependencies and start the dev server:

   ```bash
   bun install
   bun dev:web
   ```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Running with Docker

```bash
docker compose up -d
```

The app will be available at [http://localhost:3100](http://localhost:3100).

## License

Proprietary. All rights reserved.

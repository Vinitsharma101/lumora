-- Grace Studio Backend Schema Migration
-- Creates all tables needed by the FastAPI backend.
-- Safe to run multiple times (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- ============================================================================
-- 1. Core auth tables (may already exist from Drizzle)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    image TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    expires_at TIMESTAMP NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at TIMESTAMP,
    refresh_token_expires_at TIMESTAMP,
    scope TEXT,
    password TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verifications (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- ============================================================================
-- 2. AI Chat tables (may already exist from Drizzle)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    tool_calls TEXT,
    tool_results TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. Projects table — backend version with JSONB and numeric fields
--    The Drizzle schema uses text columns; we add missing columns if needed.
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    settings JSONB,
    scenes JSONB,
    width INTEGER DEFAULT 1920,
    height INTEGER DEFAULT 1080,
    fps INTEGER DEFAULT 30,
    duration FLOAT DEFAULT 0.0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add columns that the backend needs but Drizzle may not have created
DO $$ BEGIN
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS width INTEGER DEFAULT 1920;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS height INTEGER DEFAULT 1080;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS fps INTEGER DEFAULT 30;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS duration FLOAT DEFAULT 0.0;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- 4. Media Assets
-- ============================================================================

CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    mime_type TEXT,
    file_size INTEGER DEFAULT 0,
    storage_path TEXT NOT NULL,
    public_url TEXT,
    width INTEGER,
    height INTEGER,
    duration FLOAT,
    fps FLOAT,
    thumbnail_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. Render Jobs
-- ============================================================================

CREATE TABLE IF NOT EXISTS render_jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued',
    progress FLOAT DEFAULT 0.0,
    error_message TEXT,
    format TEXT DEFAULT 'mp4',
    quality TEXT DEFAULT 'high',
    width INTEGER DEFAULT 1920,
    height INTEGER DEFAULT 1080,
    fps INTEGER DEFAULT 30,
    timeline_data JSONB,
    output_url TEXT,
    output_size INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- ============================================================================
-- 6. AI Jobs (video gen, image gen, auto-edit, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    progress FLOAT DEFAULT 0.0,
    current_step TEXT,
    chunks_total INTEGER NOT NULL DEFAULT 1,
    chunks_completed INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    input_data JSONB,
    output_data JSONB,
    provider TEXT,
    provider_job_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- ============================================================================
-- 7. Project Collaborators
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_collaborators (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'editor',
    invited_by TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. Characters (consistency for AI generation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    reference_image_url TEXT,
    visual_analysis TEXT,
    style_suffix TEXT,
    pinecone_id TEXT,
    consistency_seed INTEGER,
    metadata_json JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 9. Agent Sessions (agentic video creation pipeline)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'running',
    query TEXT,
    plan JSONB,
    pending_questions JSONB,
    answered_questions JSONB,
    generated_assets JSONB,
    assembled_timeline JSONB,
    raw_video_url TEXT,
    chunk_metadata JSONB,
    video_map JSONB,
    global_style_context JSONB,
    review_notes JSONB,
    messages JSONB,
    error TEXT,
    acts_progress JSONB,
    cost_estimate JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 10. Indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_project_id ON media_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_user_id ON media_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_project_id ON render_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_id ON ai_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_project_id ON ai_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_id ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_project_id ON agent_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_project_id ON project_collaborators(project_id);

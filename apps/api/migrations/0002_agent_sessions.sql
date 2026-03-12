-- Migration: Add agent_sessions table for agentic video pipeline
-- Matches AgentSession model in app/models.py

CREATE TABLE IF NOT EXISTS agent_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Pipeline state
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

    -- Hierarchical progress tracking
    acts_progress JSONB,
    cost_estimate JSONB,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_project_id ON agent_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);

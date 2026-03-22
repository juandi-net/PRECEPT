-- Skill index: tracks all skill files and their metadata
-- See docs/skills.md — Skill Index Schema
CREATE TABLE skill_index (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT UNIQUE NOT NULL,
  scope           TEXT NOT NULL CHECK (scope IN ('org_wide', 'role_specific', 'leadership_only')),
  role            TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  trigger_tags    TEXT[] DEFAULT '{}',
  file_path       TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for Dispatcher skill selection queries
CREATE INDEX idx_skill_index_scope_status ON skill_index (scope, status);
CREATE INDEX idx_skill_index_trigger_tags ON skill_index USING GIN (trigger_tags);

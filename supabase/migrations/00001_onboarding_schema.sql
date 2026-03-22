-- Onboarding sessions: tracks the interview state
CREATE TABLE onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID, -- nullable for V0.1 single-user; required when multi-org
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  conversation JSONB NOT NULL DEFAULT '[]'::jsonb,
  precepts_draft JSONB NOT NULL DEFAULT '{}'::jsonb,
  extraction_tracker JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Finalized Precepts document
CREATE TABLE precepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID, -- nullable for V0.1 single-user; required when multi-org
  session_id UUID REFERENCES onboarding_sessions(id),
  version INTEGER NOT NULL DEFAULT 1,
  content JSONB NOT NULL,
  classification TEXT NOT NULL DEFAULT 'internal'
    CHECK (classification IN ('public', 'internal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log: append-only record of all system events
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  agent TEXT NOT NULL,
  detail JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce append-only on audit_log
REVOKE UPDATE, DELETE ON audit_log FROM anon, authenticated;

-- Index for session lookups
CREATE INDEX idx_onboarding_sessions_status ON onboarding_sessions(status);

-- Index for audit log queries
CREATE INDEX idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

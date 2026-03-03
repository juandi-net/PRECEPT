-- Enable pgvector (needed by role_memory table below)
CREATE EXTENSION IF NOT EXISTS vector;

-- Strategic initiatives
CREATE TABLE initiatives (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES orgs(id),
  name          TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
  phase_current INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ
);

-- CEO plans
CREATE TABLE plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES orgs(id),
  initiative_id   UUID REFERENCES initiatives(id),
  content         JSONB NOT NULL,
  advisor_verdict TEXT CHECK (advisor_verdict IN ('APPROVED', 'APPROVED_WITH_CONCERNS', 'FLAGGED')),
  advisor_notes   TEXT,
  owner_approved  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks (atomic work units)
CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES orgs(id),
  plan_id         UUID REFERENCES plans(id),
  initiative_id   UUID REFERENCES initiatives(id),
  phase           INTEGER NOT NULL,
  state           TEXT NOT NULL DEFAULT 'PLANNED'
    CHECK (state IN (
      'PLANNED', 'QUEUED', 'DISPATCHED', 'IN_PROGRESS',
      'REVIEW', 'POLISH', 'JUDGMENT', 'REVISION',
      'ACCEPTED', 'ESCALATED', 'FAILED'
    )),
  role            TEXT NOT NULL
    CHECK (role IN ('researcher', 'coder', 'writer', 'analyst', 'ops')),
  assigned_worker TEXT,
  spec            JSONB NOT NULL,
  output          JSONB,
  skills_loaded   TEXT[] DEFAULT '{}',
  depends_on      UUID[] DEFAULT '{}',
  revision_count  INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ
);

-- Task state transition log
CREATE TABLE task_transitions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES orgs(id),
  task_id    UUID NOT NULL REFERENCES tasks(id),
  from_state TEXT,
  to_state   TEXT NOT NULL,
  agent_id   TEXT NOT NULL,
  reason     TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent performance profiles
CREATE TABLE agent_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES orgs(id),
  agent_id        TEXT NOT NULL,
  role            TEXT NOT NULL,
  model           TEXT NOT NULL,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  acceptance_rate NUMERIC(5,2),
  recent_trend    TEXT CHECK (recent_trend IN ('improving', 'stable', 'declining')),
  strengths       TEXT[] DEFAULT '{}',
  weaknesses      TEXT[] DEFAULT '{}',
  craft_notes     TEXT,
  trust_level     TEXT NOT NULL DEFAULT 'apprentice'
    CHECK (trust_level IN ('apprentice', 'journeyman', 'master')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ
);

-- Decision log
CREATE TABLE decision_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES orgs(id),
  initiative_id UUID REFERENCES initiatives(id),
  decision      TEXT NOT NULL,
  reasoning     TEXT NOT NULL,
  alternatives  TEXT,
  why_not       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lesson artifacts
CREATE TABLE lesson_artifacts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES orgs(id),
  initiative_id  UUID REFERENCES initiatives(id),
  what_tried     TEXT NOT NULL,
  what_happened  TEXT NOT NULL,
  why            TEXT,
  what_learned   TEXT NOT NULL,
  do_differently TEXT,
  never_repeat   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Role memory (pgvector)
CREATE TABLE role_memory (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES orgs(id),
  role              TEXT NOT NULL,
  domain            TEXT,
  content           TEXT NOT NULL,
  embedding         vector(768) NOT NULL,
  source_task       UUID REFERENCES tasks(id),
  confidence        TEXT NOT NULL DEFAULT 'medium'
    CHECK (confidence IN ('high', 'medium', 'low')),
  entry_type        TEXT NOT NULL DEFAULT 'finding'
    CHECK (entry_type IN ('finding', 'craft_pattern', 'contact')),
  status            TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'stale', 'archived')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_retrieved_at TIMESTAMPTZ
);

-- Team Bulletin
CREATE TABLE team_bulletin (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES orgs(id),
  task_id    UUID REFERENCES tasks(id),
  role       TEXT NOT NULL,
  summary    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Owner feedback history
CREATE TABLE owner_feedback_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES orgs(id),
  source         TEXT NOT NULL DEFAULT 'briefing_reply'
    CHECK (source IN ('briefing_reply', 'decision_room', 'direct')),
  raw_content    TEXT NOT NULL,
  parsed_intent  JSONB,
  plan_id        UUID REFERENCES plans(id),
  initiative_id  UUID REFERENCES initiatives(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Internal messages
CREATE TABLE messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES orgs(id),
  from_role      TEXT NOT NULL,
  from_agent_id  TEXT NOT NULL,
  to_role        TEXT NOT NULL,
  message_type   TEXT NOT NULL,
  payload        JSONB NOT NULL,
  reference_id   UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tasks_plan_id ON tasks(plan_id);
CREATE INDEX idx_tasks_state ON tasks(state);
CREATE INDEX idx_tasks_initiative_id ON tasks(initiative_id);
CREATE INDEX idx_task_transitions_task_id ON task_transitions(task_id);
CREATE INDEX idx_task_transitions_created_at ON task_transitions(created_at);
CREATE INDEX idx_agent_profiles_agent_id ON agent_profiles(agent_id);
CREATE INDEX idx_role_memory_role_status ON role_memory(role, status);
CREATE INDEX idx_messages_reference_id ON messages(reference_id);
CREATE INDEX idx_messages_message_type ON messages(message_type);
CREATE INDEX idx_team_bulletin_created_at ON team_bulletin(created_at);
CREATE INDEX idx_owner_feedback_created_at ON owner_feedback_history(created_at);

-- RLS on all new tables
ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_bulletin ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_feedback_history ENABLE ROW LEVEL SECURITY;

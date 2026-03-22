-- Sprint 5: Self-Learning Loop + Structural Preparation for Model Growth
-- Creates role_config, skill_events, evaluation_metrics, experiments, role_summaries
-- Extends skill_index, tasks, owner_feedback_history

-- ============================================================================
-- 1. Role Config — single source of truth for role definitions
-- ============================================================================

CREATE TABLE role_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES orgs(id),
  role            TEXT NOT NULL,
  tier            TEXT NOT NULL DEFAULT 'execution'
    CHECK (tier IN ('board', 'leadership', 'system', 'execution')),
  model_tier      TEXT NOT NULL DEFAULT 'sonnet',
  model_override  TEXT,
  endpoint_override TEXT,
  context_includes TEXT[] NOT NULL DEFAULT '{}',
  context_excludes TEXT[] NOT NULL DEFAULT '{}',
  evaluation_path TEXT,
  escalation_target TEXT,
  separation_policy TEXT NOT NULL DEFAULT 'always'
    CHECK (separation_policy IN ('always', 'high_stakes', 'never')),
  trust_autonomy  TEXT NOT NULL DEFAULT 'execute_only'
    CHECK (trust_autonomy IN ('execute_only', 'flag_and_execute', 'propose', 'autonomous_bounded')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ,
  UNIQUE(org_id, role)
);

CREATE INDEX idx_role_config_org ON role_config(org_id);

-- Seed default config for existing orgs
INSERT INTO role_config (org_id, role, tier, model_tier, context_includes, context_excludes, evaluation_path, escalation_target, separation_policy, trust_autonomy)
SELECT o.id, r.role, r.tier, r.model_tier, r.context_includes, r.context_excludes, r.evaluation_path, r.escalation_target, r.separation_policy, r.trust_autonomy
FROM orgs o
CROSS JOIN (VALUES
  ('ceo',       'leadership', 'opus',   ARRAY['precepts','state','role_memory','team_bulletin','skills','field_signals','root'], ARRAY[]::TEXT[], NULL, 'board', 'always', 'propose'),
  ('judge',     'leadership', 'opus',   ARRAY['task_output','task_spec','acceptance_criteria','outcome_eval_skill'], ARRAY['ceo_rationale','reviewer_notes'], NULL, 'ceo', 'always', 'execute_only'),
  ('reviewer',  'leadership', 'opus',   ARRAY['task_output','task_spec','craft_eval_skill','domain_role_memory'], ARRAY['ceo_rationale','other_worker_outputs'], NULL, 'ceo', 'always', 'execute_only'),
  ('dispatcher','leadership', 'opus',   ARRAY['plan','dependency_graph','agent_profiles','skill_index'], ARRAY['precepts','ceo_rationale'], NULL, 'ceo', 'never', 'execute_only'),
  ('advisor',   'leadership', 'opus',   ARRAY['ceo_plan','precepts','decision_log','lesson_artifacts','performance_data'], ARRAY[]::TEXT[], NULL, 'board', 'always', 'propose'),
  ('scribe',    'system',     'sonnet', ARRAY['audit_log','initiatives','lessons','skill_changes'], ARRAY[]::TEXT[], NULL, NULL, 'never', 'execute_only'),
  ('curator',   'system',     'sonnet', ARRAY['reviewer_patterns','judge_patterns','lesson_artifacts','skill_index'], ARRAY[]::TEXT[], NULL, 'ceo', 'never', 'flag_and_execute'),
  ('worker',    'execution',  'sonnet', ARRAY['task_spec','skills','role_memory','chain_context','team_bulletin'], ARRAY['ceo_rationale','eval_feedback','other_initiatives'], 'reviewer', 'ceo', 'always', 'flag_and_execute')
) AS r(role, tier, model_tier, context_includes, context_excludes, evaluation_path, escalation_target, separation_policy, trust_autonomy);

ALTER TABLE role_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_role_config" ON role_config
  FOR SELECT USING (user_owns_org(org_id));

-- ============================================================================
-- 2. Skill Events — meta-learning data collection
-- ============================================================================

CREATE TABLE skill_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES orgs(id),
  skill_name  TEXT NOT NULL,
  event_type  TEXT NOT NULL
    CHECK (event_type IN (
      'created', 'refined', 'deprecated',
      'loaded', 'correlated_accept', 'correlated_reject'
    )),
  version     INTEGER,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skill_events_org ON skill_events(org_id);
CREATE INDEX idx_skill_events_skill ON skill_events(skill_name);
CREATE INDEX idx_skill_events_type ON skill_events(event_type);

ALTER TABLE skill_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_skill_events" ON skill_events
  FOR SELECT USING (user_owns_org(org_id));

-- ============================================================================
-- 3. Evaluation Metrics — weekly aggregate stats
-- ============================================================================

CREATE TABLE evaluation_metrics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES orgs(id),
  period      TEXT NOT NULL,
  reviewer_tasks   INTEGER NOT NULL DEFAULT 0,
  reviewer_polish  INTEGER NOT NULL DEFAULT 0,
  reviewer_pass    INTEGER NOT NULL DEFAULT 0,
  judge_tasks      INTEGER NOT NULL DEFAULT 0,
  judge_accept     INTEGER NOT NULL DEFAULT 0,
  judge_revise     INTEGER NOT NULL DEFAULT 0,
  judge_escalate   INTEGER NOT NULL DEFAULT 0,
  reviewer_miss    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, period)
);

CREATE INDEX idx_eval_metrics_org ON evaluation_metrics(org_id);

ALTER TABLE evaluation_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_eval_metrics" ON evaluation_metrics
  FOR SELECT USING (user_owns_org(org_id));

-- ============================================================================
-- 4. Experiments — autonomous optimization via A/B tests
-- ============================================================================

CREATE TABLE experiments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES orgs(id),
  initiative_id     UUID REFERENCES initiatives(id),
  hypothesis        TEXT NOT NULL,
  variants          TEXT[] NOT NULL,
  metric            TEXT NOT NULL,
  sample_size       INTEGER NOT NULL DEFAULT 3,
  success_threshold NUMERIC(5,2) NOT NULL DEFAULT 10.0,
  status            TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'running', 'concluded')),
  results           JSONB,
  created_by        TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluded_at      TIMESTAMPTZ
);

CREATE INDEX idx_experiments_org ON experiments(org_id);
CREATE INDEX idx_experiments_status ON experiments(status);

ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_experiments" ON experiments
  FOR SELECT USING (user_owns_org(org_id));

-- ============================================================================
-- 5. Role Summaries — bounded context for workers
-- ============================================================================

CREATE TABLE role_summaries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES orgs(id),
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  token_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, role)
);

ALTER TABLE role_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_role_summaries" ON role_summaries
  FOR SELECT USING (user_owns_org(org_id));

-- ============================================================================
-- 6. Extend existing tables
-- ============================================================================

-- skill_index: community skill tracking
ALTER TABLE skill_index ADD COLUMN IF NOT EXISTS
  source TEXT NOT NULL DEFAULT 'internal';
ALTER TABLE skill_index ADD COLUMN IF NOT EXISTS
  probation_remaining INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skill_index ADD COLUMN IF NOT EXISTS
  source_metadata JSONB DEFAULT '{}';

-- tasks: experiment variant tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS
  experiment_id UUID REFERENCES experiments(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS
  experiment_variant TEXT;

-- owner_feedback_history: time budget tracking
ALTER TABLE owner_feedback_history ADD COLUMN IF NOT EXISTS
  estimated_minutes NUMERIC(5,1);

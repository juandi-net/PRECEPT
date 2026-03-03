-- Fix: agent_profiles needs a UNIQUE constraint on (org_id, agent_id)
-- for upsert (INSERT ... ON CONFLICT) to work correctly.
-- Without this, every upsert becomes a plain INSERT creating duplicates.

DROP INDEX IF EXISTS idx_agent_profiles_agent_id;

CREATE UNIQUE INDEX idx_agent_profiles_org_agent
  ON agent_profiles(org_id, agent_id);

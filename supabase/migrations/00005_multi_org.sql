-- Create orgs table
CREATE TABLE orgs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  owner_id   UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status     TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived'))
);

ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;

-- Add org_id to existing Sprint 1 tables
ALTER TABLE onboarding_sessions
  ADD COLUMN org_id UUID REFERENCES orgs(id);

ALTER TABLE precepts
  ADD COLUMN org_id UUID REFERENCES orgs(id);

ALTER TABLE audit_log
  ADD COLUMN org_id UUID REFERENCES orgs(id);

ALTER TABLE skill_index
  ADD COLUMN org_id UUID REFERENCES orgs(id);

-- Fix: skill_index.name has a global UNIQUE constraint from 00003.
-- Replace with composite (org_id, name) so different orgs can have same skill names.
ALTER TABLE skill_index DROP CONSTRAINT skill_index_name_key;

-- Backfill: Create initial org, set org_id on all existing rows.
-- This runs as a DO block so it's atomic.
DO $$
DECLARE
  initial_org_id UUID;
BEGIN
  INSERT INTO orgs (name, slug, owner_id)
  VALUES ('My Org', 'my-org', gen_random_uuid())
  RETURNING id INTO initial_org_id;

  UPDATE onboarding_sessions SET org_id = initial_org_id WHERE org_id IS NULL;
  UPDATE precepts SET org_id = initial_org_id WHERE org_id IS NULL;
  UPDATE audit_log SET org_id = initial_org_id WHERE org_id IS NULL;
  UPDATE skill_index SET org_id = initial_org_id WHERE org_id IS NULL;
END $$;

-- Now make org_id NOT NULL
ALTER TABLE onboarding_sessions ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE precepts ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE audit_log ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE skill_index ALTER COLUMN org_id SET NOT NULL;

-- Add composite unique constraint now that org_id is NOT NULL
ALTER TABLE skill_index ADD CONSTRAINT skill_index_org_name_unique UNIQUE (org_id, name);

-- Update RLS policies to include org_id scoping
-- (Default deny-all with service_role bypass is still in place from 00004)
-- Add org-scoped policies for future authenticated access:
CREATE POLICY org_isolation_onboarding ON onboarding_sessions
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_precepts ON precepts
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_audit ON audit_log
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_skills ON skill_index
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

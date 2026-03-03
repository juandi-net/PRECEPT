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

-- Backfill: Create ROOKIE org, set org_id on all existing rows.
-- This runs as a DO block so it's atomic.
DO $$
DECLARE
  rookie_org_id UUID;
BEGIN
  INSERT INTO orgs (name, slug, owner_id)
  VALUES ('ROOKIE', 'rookie', gen_random_uuid())
  RETURNING id INTO rookie_org_id;

  UPDATE onboarding_sessions SET org_id = rookie_org_id WHERE org_id IS NULL;
  UPDATE precepts SET org_id = rookie_org_id WHERE org_id IS NULL;
  UPDATE audit_log SET org_id = rookie_org_id WHERE org_id IS NULL;
  UPDATE skill_index SET org_id = rookie_org_id WHERE org_id IS NULL;
END $$;

-- Now make org_id NOT NULL
ALTER TABLE onboarding_sessions ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE precepts ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE audit_log ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE skill_index ALTER COLUMN org_id SET NOT NULL;

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

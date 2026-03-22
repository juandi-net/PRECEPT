-- Formalize the github_org column that code already references.
ALTER TABLE org_secrets ADD COLUMN IF NOT EXISTS github_org TEXT;

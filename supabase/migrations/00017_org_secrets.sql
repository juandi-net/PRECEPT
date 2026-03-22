-- org_secrets: per-org credentials, readable only by service role
CREATE TABLE org_secrets (
  org_id         UUID PRIMARY KEY REFERENCES orgs(id),
  resend_api_key TEXT,
  email_domain   TEXT,
  owner_email    TEXT,
  github_token   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE org_secrets ENABLE ROW LEVEL SECURITY;

-- Block ALL client access — only engine (service role) can read
CREATE POLICY "Service role only" ON org_secrets
  FOR ALL USING (false);

-- Backfill existing org with NULL values
-- Actual secrets must be set manually via Supabase dashboard — never in source
INSERT INTO org_secrets (org_id)
SELECT id FROM orgs;

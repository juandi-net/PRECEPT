-- Add GitHub App columns to org_secrets for the manifest flow.
-- These replace github_token for orgs using per-org GitHub Apps.
-- github_token remains for backward compatibility (orgs still using static PATs).

ALTER TABLE org_secrets
  ADD COLUMN IF NOT EXISTS github_app_id             INTEGER,
  ADD COLUMN IF NOT EXISTS github_app_slug           TEXT,
  ADD COLUMN IF NOT EXISTS github_app_pem            TEXT,
  ADD COLUMN IF NOT EXISTS github_app_webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS github_app_client_id      TEXT,
  ADD COLUMN IF NOT EXISTS github_app_client_secret  TEXT,
  ADD COLUMN IF NOT EXISTS github_installation_id    INTEGER;

COMMENT ON COLUMN org_secrets.github_app_id IS 'GitHub App ID returned from manifest flow';
COMMENT ON COLUMN org_secrets.github_app_slug IS 'GitHub App slug (e.g. my-org-worker)';
COMMENT ON COLUMN org_secrets.github_app_pem IS 'PEM-encoded private key for JWT signing';
COMMENT ON COLUMN org_secrets.github_app_webhook_secret IS 'Webhook secret from manifest flow';
COMMENT ON COLUMN org_secrets.github_app_client_id IS 'OAuth client ID from manifest flow';
COMMENT ON COLUMN org_secrets.github_app_client_secret IS 'OAuth client secret from manifest flow';
COMMENT ON COLUMN org_secrets.github_installation_id IS 'Installation ID after app is installed on the org';

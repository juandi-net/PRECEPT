-- All code paths now read resend_api_key, linear_api_key, github_token
-- from org_credentials. Safe to drop the redundant columns from org_secrets.

ALTER TABLE org_secrets DROP COLUMN IF EXISTS resend_api_key;
ALTER TABLE org_secrets DROP COLUMN IF EXISTS linear_api_key;
ALTER TABLE org_secrets DROP COLUMN IF EXISTS github_token;

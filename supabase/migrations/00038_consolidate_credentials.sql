-- Move resend_api_key, linear_api_key, github_token from org_secrets
-- into org_credentials so all dynamic credentials live in one table.
-- ON CONFLICT DO NOTHING: idempotent if already inserted.

INSERT INTO org_credentials (org_id, service_key, credential_value, description)
SELECT org_id, 'resend_api_key', resend_api_key, 'Email send/receive via Resend'
FROM org_secrets
WHERE resend_api_key IS NOT NULL
ON CONFLICT (org_id, service_key) DO NOTHING;

INSERT INTO org_credentials (org_id, service_key, credential_value, description)
SELECT org_id, 'linear_api_key', linear_api_key, 'Linear API access for issue tracking'
FROM org_secrets
WHERE linear_api_key IS NOT NULL
ON CONFLICT (org_id, service_key) DO NOTHING;

INSERT INTO org_credentials (org_id, service_key, credential_value, description)
SELECT org_id, 'github_token', github_token, 'GitHub personal access token for API operations'
FROM org_secrets
WHERE github_token IS NOT NULL
ON CONFLICT (org_id, service_key) DO NOTHING;

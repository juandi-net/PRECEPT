-- Capability acquisition: key-value credential store for dynamic service credentials
CREATE TABLE org_credentials (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES orgs(id),
  service_key      TEXT NOT NULL,
  credential_value TEXT NOT NULL,
  provisioned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at      TIMESTAMPTZ,
  UNIQUE (org_id, service_key)
);

ALTER TABLE org_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON org_credentials
  FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX idx_org_credentials_org ON org_credentials(org_id);

COMMENT ON COLUMN org_credentials.service_key
  IS 'lowercase_snake_case: service_purpose, e.g. cloudflare_api_token, stripe_secret_key';

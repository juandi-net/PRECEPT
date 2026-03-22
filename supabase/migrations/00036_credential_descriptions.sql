-- Add description column to org_credentials for capability awareness
ALTER TABLE org_credentials ADD COLUMN description TEXT;

COMMENT ON COLUMN org_credentials.description
  IS 'Brief capability description: what this credential enables (e.g. "DNS, Pages, Workers for example.org")';

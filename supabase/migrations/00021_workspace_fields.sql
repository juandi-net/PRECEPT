-- Add github_repo_url to org_secrets for workspace cloning
ALTER TABLE org_secrets ADD COLUMN IF NOT EXISTS github_repo_url TEXT;

-- Add linear fields (used by Linear integration)
ALTER TABLE org_secrets ADD COLUMN IF NOT EXISTS linear_api_key TEXT;
ALTER TABLE org_secrets ADD COLUMN IF NOT EXISTS linear_team_id TEXT;

-- Add linear_issue_id to tasks for Linear mirror
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS linear_issue_id TEXT;

-- Per-initiative GitHub repo URL (overrides org-level default)
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS github_repo_url TEXT;

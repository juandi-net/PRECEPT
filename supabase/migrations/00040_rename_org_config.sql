-- With credential columns gone, org_secrets contains only configuration:
-- email_domain, owner_email, github_org, github_repo_url, linear_team_id,
-- plus the GitHub App column cluster. Rename to reflect its actual purpose.

ALTER TABLE org_secrets RENAME TO org_config;

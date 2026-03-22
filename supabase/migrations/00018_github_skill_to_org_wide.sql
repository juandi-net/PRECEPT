-- Move github skill from role_specific/coder to org_wide
UPDATE skill_index
SET
  name = 'github',
  scope = 'org_wide',
  role = NULL,
  trigger_tags = ARRAY['github','git','repository','pr','issues'],
  file_path = 'skills/org-wide/github.md',
  updated_at = now()
WHERE name = 'github-project';

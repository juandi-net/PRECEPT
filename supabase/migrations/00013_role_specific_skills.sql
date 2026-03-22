-- Seed role-specific skills into skill_index.
-- file_path points to the skill DIRECTORY for role-specific skills (so Workers
-- can resolve scripts/ relative to the skill root) and to the .md file for
-- org-wide skills (which have no scripts).
--
-- Uses dynamic org lookup (CROSS JOIN orgs) so
-- the migration doesn't hardcode a UUID.
INSERT INTO skill_index (org_id, name, scope, role, status, trigger_tags, file_path)
SELECT o.id, v.name, v.scope, v.role, v.status, v.trigger_tags, v.file_path
FROM orgs o
CROSS JOIN (VALUES
  ('web-research', 'role_specific', 'researcher', 'active', ARRAY['research','web','search','synthesis'], 'skills/role-specific/researcher/web-research/'),
  ('competitive-analysis', 'role_specific', 'researcher', 'active', ARRAY['research','competitive','analysis','comparison'], 'skills/role-specific/researcher/competitive-analysis/'),
  ('github-project', 'role_specific', 'coder', 'active', ARRAY['code','github','git','development'], 'skills/role-specific/coder/github-project/'),
  ('web-app-development', 'role_specific', 'coder', 'active', ARRAY['code','web','development','testing'], 'skills/role-specific/coder/web-app-development/'),
  ('content-creation', 'role_specific', 'writer', 'active', ARRAY['writing','content','documents','reports'], 'skills/role-specific/writer/content-creation/'),
  ('outreach-draft', 'role_specific', 'writer', 'active', ARRAY['writing','email','outreach','communication'], 'skills/role-specific/writer/outreach-draft/'),
  ('data-analysis', 'role_specific', 'analyst', 'active', ARRAY['analysis','data','python','insights'], 'skills/role-specific/analyst/data-analysis/'),
  ('market-research', 'role_specific', 'analyst', 'active', ARRAY['analysis','market','research','quantitative'], 'skills/role-specific/analyst/market-research/')
) AS v(name, scope, role, status, trigger_tags, file_path)
WHERE TRUE -- apply to all orgs
ON CONFLICT (org_id, name) DO UPDATE SET
  scope = EXCLUDED.scope,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  trigger_tags = EXCLUDED.trigger_tags,
  file_path = EXCLUDED.file_path,
  updated_at = now();

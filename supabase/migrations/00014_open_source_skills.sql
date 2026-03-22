-- Add open source skills to skill_index.
-- Sprint 4.1: Superpowers (TDD, debugging), Vercel (react, design, deploy),
-- Visual Explainer, Agent Browser.

-- New skills
INSERT INTO skill_index (org_id, name, scope, role, status, trigger_tags, file_path)
SELECT o.id, v.name, v.scope, v.role, v.status, v.trigger_tags, v.file_path
FROM orgs o
CROSS JOIN (VALUES
  ('agent-browser', 'org_wide', NULL::TEXT, 'active',
   ARRAY['web','browser','scraping','automation'],
   'skills/org-wide/agent-browser.md'),
  ('test-driven-development', 'role_specific', 'coder', 'active',
   ARRAY['code','testing','tdd','development'],
   'skills/role-specific/coder/test-driven-development/'),
  ('systematic-debugging', 'role_specific', 'coder', 'active',
   ARRAY['code','debugging','testing','bugfix'],
   'skills/role-specific/coder/systematic-debugging/'),
  ('react-best-practices', 'role_specific', 'coder', 'active',
   ARRAY['code','react','nextjs','web','development','frontend'],
   'skills/role-specific/coder/react-best-practices/'),
  ('vercel-deploy', 'role_specific', 'coder', 'active',
   ARRAY['code','deploy','vercel','preview','hosting'],
   'skills/role-specific/coder/vercel-deploy/'),
  ('code-structure', 'role_specific', 'coder', 'active',
   ARRAY['code','architecture','structure','refactor'],
   'skills/role-specific/coder/code-structure/'),
  ('visual-explainer', 'role_specific', 'writer', 'active',
   ARRAY['writing','visualization','html','diagrams','slides','presentation'],
   'skills/role-specific/writer/visual-explainer/'),
  ('web-design-guidelines', 'org_wide', NULL::TEXT, 'active',
   ARRAY['design','accessibility','performance','ux','web'],
   'skills/org-wide/web-design-guidelines.md')
) AS v(name, scope, role, status, trigger_tags, file_path)
WHERE TRUE -- apply to all orgs
ON CONFLICT (org_id, name) DO UPDATE SET
  scope = EXCLUDED.scope,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  trigger_tags = EXCLUDED.trigger_tags,
  file_path = EXCLUDED.file_path,
  updated_at = now();

-- Deprecate replaced skill
UPDATE skill_index SET status = 'deprecated', updated_at = now()
WHERE name = 'web-app-development';

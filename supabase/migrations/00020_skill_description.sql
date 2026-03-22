-- Add description column to skill_index
ALTER TABLE skill_index ADD COLUMN description TEXT NOT NULL DEFAULT '';

-- Populate descriptions for existing migration-seeded skills
UPDATE skill_index SET description = 'Search the web for information and compile research findings' WHERE name = 'web-research';
UPDATE skill_index SET description = 'Analyze competitors and market positioning' WHERE name = 'competitive-analysis';
UPDATE skill_index SET description = 'Create written content — articles, copy, documentation' WHERE name = 'content-creation';
UPDATE skill_index SET description = 'Draft outreach messages — emails, proposals, introductions' WHERE name = 'outreach-draft';
UPDATE skill_index SET description = 'Analyze datasets and extract insights' WHERE name = 'data-analysis';
UPDATE skill_index SET description = 'Research market trends, sizing, and opportunities' WHERE name = 'market-research';
UPDATE skill_index SET description = 'Automate browser interactions — navigation, scraping, form filling' WHERE name = 'agent-browser';
UPDATE skill_index SET description = 'Visual design guidelines for web interfaces' WHERE name = 'web-design-guidelines';
UPDATE skill_index SET description = 'Write failing tests first, then implement to make them pass' WHERE name = 'test-driven-development';
UPDATE skill_index SET description = 'Diagnose bugs methodically — reproduce, isolate, fix, verify' WHERE name = 'systematic-debugging';
UPDATE skill_index SET description = 'React component patterns, hooks, and best practices' WHERE name = 'react-best-practices';
UPDATE skill_index SET description = 'Deploy applications to Vercel' WHERE name = 'vercel-deploy';
UPDATE skill_index SET description = 'Organize code into clean, maintainable structures' WHERE name = 'code-structure';
UPDATE skill_index SET description = 'Create visual explanations — diagrams, charts, infographics' WHERE name = 'visual-explainer';
UPDATE skill_index SET description = 'Interact with GitHub — clone, commit, PR, issues' WHERE name = 'github';

-- Move skill content from filesystem to database.
-- After running the migration script (skill-content-migration.ts),
-- all active skills will have their content in this column.
ALTER TABLE skill_index ADD COLUMN content TEXT;
ALTER TABLE skill_index ALTER COLUMN file_path DROP NOT NULL;

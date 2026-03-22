-- Atomic increment functions to replace read-then-write pattern in tasks.ts
CREATE OR REPLACE FUNCTION increment_revision_count(task_uuid UUID)
RETURNS INTEGER AS $$
  UPDATE tasks
  SET revision_count = revision_count + 1,
      updated_at = now()
  WHERE id = task_uuid
  RETURNING revision_count;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION increment_polish_count(task_uuid UUID)
RETURNS INTEGER AS $$
  UPDATE tasks
  SET polish_count = polish_count + 1,
      updated_at = now()
  WHERE id = task_uuid
  RETURNING polish_count;
$$ LANGUAGE sql;

-- Tag where a task originated so the engine can follow up with the owner
ALTER TABLE tasks
  ADD COLUMN source TEXT NOT NULL DEFAULT 'planning_cycle'
  CHECK (source IN ('planning_cycle', 'owner_directed'));

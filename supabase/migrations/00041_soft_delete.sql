-- Soft delete support for initiatives and tasks

ALTER TABLE initiatives ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for query performance (most queries filter on deleted_at IS NULL)
CREATE INDEX idx_initiatives_not_deleted ON initiatives (org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_not_deleted ON tasks (org_id) WHERE deleted_at IS NULL;

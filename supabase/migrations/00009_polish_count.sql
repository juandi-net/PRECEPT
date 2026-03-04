-- Add separate polish_count to tasks so POLISH rework attempts
-- don't share the revision_count used for Judge REVISE auto-escalation.
ALTER TABLE tasks ADD COLUMN polish_count INTEGER NOT NULL DEFAULT 0;

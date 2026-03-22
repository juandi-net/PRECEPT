-- Hierarchical Planning: add plan_level, parent_plan_id, board_request email threading

-- 1. plans table: add hierarchy columns
ALTER TABLE plans
  ADD COLUMN plan_level TEXT NOT NULL DEFAULT 'weekly'
    CHECK (plan_level IN ('monthly', 'weekly', 'daily', 'adhoc')),
  ADD COLUMN parent_plan_id UUID REFERENCES plans(id);

CREATE INDEX idx_plans_org_level ON plans (org_id, plan_level, created_at DESC);

-- 2. email_threads: expand thread_type to include 'board_request'
DO $$
DECLARE constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'email_threads'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%thread_type%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE email_threads DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE email_threads
  ADD CONSTRAINT email_threads_thread_type_check
    CHECK (thread_type IN ('briefing', 'escalation', 'board_request'));

-- 3. board_requests: link to email thread
ALTER TABLE board_requests
  ADD COLUMN thread_id UUID REFERENCES email_threads(id);

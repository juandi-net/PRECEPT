-- CEO ad-hoc tools: allow 'adhoc' thread type for CEO-initiated emails
ALTER TABLE email_threads
  DROP CONSTRAINT IF EXISTS email_threads_thread_type_check,
  ADD CONSTRAINT email_threads_thread_type_check
    CHECK (thread_type IN ('briefing', 'escalation', 'board_request', 'adhoc'));

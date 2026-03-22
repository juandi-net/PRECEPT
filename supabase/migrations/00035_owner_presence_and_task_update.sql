-- Owner presence tracking
ALTER TABLE orgs ADD COLUMN owner_last_seen_at TIMESTAMPTZ;

-- New message type for task-completion updates
ALTER TABLE ceo_chat_messages
  DROP CONSTRAINT ceo_chat_messages_type_check,
  ADD CONSTRAINT ceo_chat_messages_type_check
    CHECK (type IN ('briefing', 'escalation', 'response', 'owner', 'task_update'));

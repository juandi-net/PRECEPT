-- Add message type to distinguish proactive letters from reactive responses
ALTER TABLE ceo_chat_messages
  ADD COLUMN type TEXT NOT NULL DEFAULT 'response'
  CHECK (type IN ('briefing', 'escalation', 'response', 'owner'));

-- Update existing owner messages to have type 'owner'
UPDATE ceo_chat_messages SET type = 'owner' WHERE role = 'owner';

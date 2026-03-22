-- Email threading: track email conversations between CEO and owner
-- Each briefing or escalation email starts a new thread

CREATE TABLE email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  thread_type TEXT NOT NULL CHECK (thread_type IN ('briefing', 'escalation')),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_threads_org ON email_threads(org_id);
CREATE INDEX idx_email_threads_org_type ON email_threads(org_id, thread_type, created_at DESC);

CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES email_threads(id),
  org_id UUID NOT NULL REFERENCES orgs(id),
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('ceo', 'owner')),
  content TEXT NOT NULL,
  resend_email_id TEXT,
  resend_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_messages_thread ON email_messages(thread_id, created_at);
CREATE INDEX idx_email_messages_org ON email_messages(org_id, created_at DESC);

-- RLS
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_threads_org_access" ON email_threads
  FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY "email_messages_org_access" ON email_messages
  FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);

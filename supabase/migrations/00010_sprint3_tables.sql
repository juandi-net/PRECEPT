-- Sprint 3: Decision Room tables
-- Board Requests (denormalized from plans)
CREATE TABLE board_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  plan_id UUID REFERENCES plans(id),
  content TEXT NOT NULL,
  context TEXT,
  urgency TEXT NOT NULL DEFAULT 'low',
  fallback TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'responded', 'expired')),
  owner_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX idx_board_requests_org_status ON board_requests(org_id, status);

-- CEO Chat Messages (bidirectional)
CREATE TABLE ceo_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'ceo')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ceo_chat_org ON ceo_chat_messages(org_id, created_at);

-- Enable realtime on new tables + existing tables needed by frontend
-- Use DO block to skip tables already in the publication
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['board_requests','ceo_chat_messages','tasks','initiatives','audit_log'])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;

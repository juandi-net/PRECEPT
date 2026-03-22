-- Interface headline redesign: persist escalation diagnosis + read tracking
ALTER TABLE tasks ADD COLUMN escalation_diagnosis JSONB;
ALTER TABLE tasks ADD COLUMN owner_read_at TIMESTAMPTZ;
ALTER TABLE board_requests ADD COLUMN owner_read_at TIMESTAMPTZ;

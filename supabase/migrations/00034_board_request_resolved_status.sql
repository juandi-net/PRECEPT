-- Allow CEO to resolve board requests (distinct from owner responding)
ALTER TABLE board_requests DROP CONSTRAINT IF EXISTS board_requests_status_check;
ALTER TABLE board_requests ADD CONSTRAINT board_requests_status_check
  CHECK (status IN ('pending', 'responded', 'expired', 'resolved'));

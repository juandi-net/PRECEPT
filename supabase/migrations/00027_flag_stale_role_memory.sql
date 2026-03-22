-- Flag role memory entries as stale when not retrieved for N days.
-- Entries that have never been retrieved fall back to created_at.
CREATE OR REPLACE FUNCTION flag_stale_role_memory(
  target_org_id UUID,
  stale_days INT DEFAULT 30
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  flagged_count INT := 0;
BEGIN
  UPDATE role_memory
  SET status = 'stale'
  WHERE org_id = target_org_id
    AND status = 'active'
    AND (
      last_retrieved_at IS NULL AND created_at < now() - make_interval(days => stale_days)
      OR last_retrieved_at < now() - make_interval(days => stale_days)
    );

  GET DIAGNOSTICS flagged_count = ROW_COUNT;
  RETURN flagged_count;
END;
$$;

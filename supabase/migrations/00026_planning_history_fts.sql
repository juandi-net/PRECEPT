-- Full-text search index on audit_log
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(event_type, '') || ' ' ||
      coalesce(agent, '') || ' ' ||
      coalesce(detail::text, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_audit_log_fts ON audit_log USING GIN (fts);

-- Full-text search index on decision_log
ALTER TABLE decision_log ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(decision, '') || ' ' ||
      coalesce(reasoning, '') || ' ' ||
      coalesce(alternatives, '') || ' ' ||
      coalesce(why_not, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_decision_log_fts ON decision_log USING GIN (fts);

-- RPC function for full-text search across both tables
CREATE OR REPLACE FUNCTION search_planning_history(
  p_org_id UUID,
  p_query TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  source TEXT,
  id UUID,
  created_at TIMESTAMPTZ,
  event_type TEXT,
  decision_type TEXT,
  agent_id TEXT,
  summary TEXT,
  rank REAL
) LANGUAGE sql STABLE AS $$
  (
    SELECT
      'audit_log'::text as source,
      a.id,
      a.created_at,
      a.event_type,
      NULL::text as decision_type,
      a.agent as agent_id,
      left(a.detail::text, 500) as summary,
      ts_rank(a.fts, plainto_tsquery('english', p_query)) as rank
    FROM audit_log a
    WHERE a.org_id = p_org_id
      AND a.fts @@ plainto_tsquery('english', p_query)
  )
  UNION ALL
  (
    SELECT
      'decision_log'::text as source,
      d.id,
      d.created_at,
      NULL::text as event_type,
      d.decision as decision_type,
      NULL::text as agent_id,
      left(d.reasoning, 500) as summary,
      ts_rank(d.fts, plainto_tsquery('english', p_query)) as rank
    FROM decision_log d
    WHERE d.org_id = p_org_id
      AND d.fts @@ plainto_tsquery('english', p_query)
  )
  ORDER BY rank DESC
  LIMIT p_limit;
$$;

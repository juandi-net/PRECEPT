-- pgvector extension already enabled in 00006_sprint2_tables.sql

-- Create ivfflat index for fast similarity search
CREATE INDEX idx_role_memory_embedding ON role_memory
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Semantic search: returns top-K role memory entries by cosine similarity.
-- Also updates last_retrieved_at on returned rows.
CREATE OR REPLACE FUNCTION match_role_memory(
  query_embedding vector(768),
  match_org_id UUID,
  match_role TEXT,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  role TEXT,
  domain TEXT,
  content TEXT,
  confidence TEXT,
  entry_type TEXT,
  source_task UUID,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  matched_ids UUID[];
BEGIN
  -- Find matches
  RETURN QUERY
  SELECT
    rm.id,
    rm.role,
    rm.domain,
    rm.content,
    rm.confidence,
    rm.entry_type,
    rm.source_task,
    1 - (rm.embedding <=> query_embedding) AS similarity
  FROM role_memory rm
  WHERE rm.org_id = match_org_id
    AND rm.role = match_role
    AND rm.status = 'active'
  ORDER BY rm.embedding <=> query_embedding
  LIMIT match_count;

  -- Update last_retrieved_at on matched rows
  SELECT array_agg(sub.id) INTO matched_ids
  FROM (
    SELECT rm.id
    FROM role_memory rm
    WHERE rm.org_id = match_org_id
      AND rm.role = match_role
      AND rm.status = 'active'
    ORDER BY rm.embedding <=> query_embedding
    LIMIT match_count
  ) sub;

  IF matched_ids IS NOT NULL THEN
    UPDATE role_memory SET last_retrieved_at = now()
    WHERE role_memory.id = ANY(matched_ids);
  END IF;
END;
$$;

-- Deduplication: archives older entries when two entries in the same
-- org+role have cosine similarity above threshold.
CREATE OR REPLACE FUNCTION deduplicate_role_memory(
  target_org_id UUID,
  similarity_threshold FLOAT DEFAULT 0.95,
  target_role TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  archived_count INT := 0;
BEGIN
  WITH duplicates AS (
    SELECT
      a.id AS keep_id,
      b.id AS archive_id
    FROM role_memory a
    JOIN role_memory b ON a.org_id = b.org_id
      AND a.role = b.role
      AND a.id < b.id
      AND a.status = 'active'
      AND b.status = 'active'
    WHERE a.org_id = target_org_id
      AND (target_role IS NULL OR a.role = target_role)
      AND 1 - (a.embedding <=> b.embedding) > similarity_threshold
  )
  UPDATE role_memory SET status = 'archived'
  WHERE id IN (SELECT archive_id FROM duplicates);

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$;

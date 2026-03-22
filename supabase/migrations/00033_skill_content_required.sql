-- Enforce that active skills must have content.
-- Deprecated skills may retain content (for history) or have it null.
ALTER TABLE skill_index ADD CONSTRAINT skill_content_required
  CHECK (status = 'deprecated' OR content IS NOT NULL);

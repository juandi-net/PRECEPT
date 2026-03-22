-- Rename precepts table to cornerstone
ALTER TABLE precepts RENAME TO cornerstone;

-- Rename primary key constraint
ALTER TABLE cornerstone RENAME CONSTRAINT precepts_pkey TO cornerstone_pkey;

-- Rename foreign key constraints (auto-named by Postgres)
ALTER TABLE cornerstone RENAME CONSTRAINT precepts_session_id_fkey TO cornerstone_session_id_fkey;
ALTER TABLE cornerstone RENAME CONSTRAINT precepts_org_id_fkey TO cornerstone_org_id_fkey;

-- Recreate RLS policy with new name
DROP POLICY IF EXISTS "owner_read_precepts" ON cornerstone;
CREATE POLICY "owner_read_cornerstone" ON cornerstone
  FOR SELECT USING (user_owns_org(org_id));

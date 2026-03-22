-- Sprint 3: Auth-based RLS policies for frontend access
-- Replaces the current_setting-based policies from 00005 with auth.uid()-based ones.
-- The engine uses service_role key which bypasses RLS entirely.

-- Helper function: check if authenticated user owns the org
CREATE OR REPLACE FUNCTION user_owns_org(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orgs WHERE id = check_org_id AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- Drop existing current_setting-based policies from 00005
DROP POLICY IF EXISTS org_isolation_onboarding ON onboarding_sessions;
DROP POLICY IF EXISTS org_isolation_precepts ON precepts;
DROP POLICY IF EXISTS org_isolation_audit ON audit_log;
DROP POLICY IF EXISTS org_isolation_skills ON skill_index;

-- orgs (owner can read their own org)
CREATE POLICY "owner_read_orgs" ON orgs
  FOR SELECT USING (owner_id = auth.uid());

-- onboarding_sessions
CREATE POLICY "owner_read_onboarding" ON onboarding_sessions
  FOR SELECT USING (user_owns_org(org_id));

-- precepts (read-only from frontend)
CREATE POLICY "owner_read_precepts" ON precepts
  FOR SELECT USING (user_owns_org(org_id));

-- audit_log (read-only)
CREATE POLICY "owner_read_audit" ON audit_log
  FOR SELECT USING (user_owns_org(org_id));

-- skill_index (read-only)
CREATE POLICY "owner_read_skills" ON skill_index
  FOR SELECT USING (user_owns_org(org_id));

-- board_requests
ALTER TABLE board_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_board_requests" ON board_requests
  FOR SELECT USING (user_owns_org(org_id));
CREATE POLICY "owner_update_board_requests" ON board_requests
  FOR UPDATE USING (user_owns_org(org_id));

-- ceo_chat_messages
ALTER TABLE ceo_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read_chat" ON ceo_chat_messages
  FOR SELECT USING (user_owns_org(org_id));
CREATE POLICY "owner_insert_chat" ON ceo_chat_messages
  FOR INSERT WITH CHECK (user_owns_org(org_id));

-- initiatives (read-only from frontend)
CREATE POLICY "owner_read_initiatives" ON initiatives
  FOR SELECT USING (user_owns_org(org_id));

-- tasks (read-only from frontend)
CREATE POLICY "owner_read_tasks" ON tasks
  FOR SELECT USING (user_owns_org(org_id));

-- task_transitions (read-only)
CREATE POLICY "owner_read_transitions" ON task_transitions
  FOR SELECT USING (user_owns_org(org_id));

-- plans (read-only)
CREATE POLICY "owner_read_plans" ON plans
  FOR SELECT USING (user_owns_org(org_id));

-- agent_profiles (read-only)
CREATE POLICY "owner_read_profiles" ON agent_profiles
  FOR SELECT USING (user_owns_org(org_id));

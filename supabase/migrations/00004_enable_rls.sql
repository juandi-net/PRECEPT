-- Enable Row-Level Security on all tables.
-- With no policies defined, the default is deny-all for anon and authenticated roles.
-- The service_role key has BYPASSRLS and is unaffected.

ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE precepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_index ENABLE ROW LEVEL SECURITY;

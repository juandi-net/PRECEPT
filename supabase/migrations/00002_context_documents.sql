-- Add context_documents column to onboarding_sessions
ALTER TABLE onboarding_sessions
  ADD COLUMN context_documents JSONB DEFAULT NULL;

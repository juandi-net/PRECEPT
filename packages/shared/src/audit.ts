export type AuditEventType =
  | 'onboarding.session_started'
  | 'onboarding.message_sent'
  | 'onboarding.message_received'
  | 'onboarding.session_completed'
  | 'onboarding.session_abandoned'
  | 'onboarding.confirmation_edits'
  | 'onboarding.documents_added'
  | 'onboarding.document_removed'
  | 'precepts.created'
  | 'precepts.updated'
  | 'ai.call'
  | 'skills.seed_generated'
  | 'skills.seed_failed';

export interface AuditEntry {
  id: string;
  eventType: AuditEventType;
  agent: string;
  detail: Record<string, unknown> | null;
  tokensUsed: number | null;
  createdAt: string;
}

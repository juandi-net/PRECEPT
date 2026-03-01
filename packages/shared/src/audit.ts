export type AuditEventType =
  | 'onboarding.session_started'
  | 'onboarding.message_sent'
  | 'onboarding.message_received'
  | 'onboarding.session_completed'
  | 'onboarding.session_abandoned'
  | 'onboarding.confirmation_edits'
  | 'precepts.created'
  | 'precepts.updated'
  | 'ai.call';

export interface AuditEntry {
  id: string;
  eventType: AuditEventType;
  agent: string;
  detail: Record<string, unknown> | null;
  tokensUsed: number | null;
  createdAt: string;
}

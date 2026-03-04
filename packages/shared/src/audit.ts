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
  | 'skills.seed_failed'
  | 'planning.cycle'
  | 'planning.scribe'
  | 'planning.ceo'
  | 'planning.advisor'
  | 'planning.approved'
  | 'dispatch.plan'
  | 'dispatch.task'
  | 'worker.start'
  | 'worker.complete'
  | 'worker.rework_complete'
  | 'worker.failed'
  | 'review.start'
  | 'review.verdict'
  | 'judge.start'
  | 'judge.verdict'
  | 'task.transition'
  | 'task.escalated'
  | 'briefing.compiled'
  | 'briefing.sent'
  | 'owner.reply'
  | 'owner.action'
  | 'memory.stored'
  | 'memory.queried'
  | 'engine.recovery';

export interface AuditEntry {
  id: string;
  eventType: AuditEventType;
  agent: string;
  detail: Record<string, unknown> | null;
  tokensUsed: number | null;
  createdAt: string;
}

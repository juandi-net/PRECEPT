export type AgentRole =
  | 'ceo'
  | 'board_advisor'
  | 'dispatcher'
  | 'scribe'
  | 'curator'
  | 'reviewer'
  | 'judge'
  | 'worker';

export type MessageType =
  | 'plan'
  | 'task_spec'
  | 'task_output'
  | 'review_verdict'
  | 'judge_verdict'
  | 'escalation'
  | 'flag'
  | 'context_package'
  | 'advisor_review'
  | 'briefing'
  | 'owner_input'
  | 'dispatch_signal'
  | 'block_report';

export interface InternalMessage {
  id: string;
  org_id: string;
  from_role: AgentRole;
  from_agent_id: string;
  to_role: AgentRole;
  message_type: MessageType;
  payload: Record<string, unknown>;
  reference_id?: string;
  created_at: string;
}

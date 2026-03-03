export type AdvisorVerdict = 'APPROVED' | 'APPROVED_WITH_CONCERNS' | 'FLAGGED';

export interface PlanTask {
  id: string;
  role: string;
  description: string;
  acceptance_criteria: string[];
  depends_on: string[];
  skills: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface PlanPhase {
  phase_number: number;
  description: string;
  tasks: PlanTask[];
}

export interface PlanInitiative {
  name: string;
  description: string;
  rationale: string;
  phases: PlanPhase[];
}

export interface PlanDecision {
  decision: string;
  reasoning: string;
  alternatives: string;
  why_not: string;
}

export interface BoardRequest {
  request: string;
  context: string;
  urgency: string;
  fallback: string;
}

export interface PlanOutput {
  initiatives: PlanInitiative[];
  decisions: PlanDecision[];
  board_requests: BoardRequest[];
}

export interface Initiative {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  phase_current: number;
  created_at: string;
  updated_at: string | null;
}

export interface Plan {
  id: string;
  org_id: string;
  initiative_id: string | null;
  content: PlanOutput;
  advisor_verdict: AdvisorVerdict | null;
  advisor_notes: string | null;
  owner_approved: boolean;
  created_at: string;
}

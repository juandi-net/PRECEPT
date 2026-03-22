export type ReviewVerdictType = 'POLISH' | 'GOOD' | 'EXCELLENT';

export interface ReviewVerdictPolish {
  verdict: 'POLISH';
  feedback: string;
  areas: string[];
}

export interface ReviewVerdictGood {
  verdict: 'GOOD';
  notes: string;
}

export interface ReviewVerdictExcellent {
  verdict: 'EXCELLENT';
  commendation: string;
  notes: string;
}

export type ReviewVerdict = ReviewVerdictPolish | ReviewVerdictGood | ReviewVerdictExcellent;

export type JudgeVerdictType = 'ACCEPT' | 'REVISE' | 'ESCALATE';

export type ValueAlignmentStatus = 'aligned' | 'drift_noted';

export interface JudgeVerdictAccept {
  verdict: 'ACCEPT';
  assessment: string;
  criteria_met: string[];
  value_alignment?: ValueAlignmentStatus;
  value_notes?: string | null;
}

export interface JudgeVerdictRevise {
  verdict: 'REVISE';
  feedback: string;
  criteria_failed: string[];
  value_alignment?: ValueAlignmentStatus;
  value_notes?: string | null;
}

export type EscalationDiagnosisType = 'spec_problem' | 'capability_problem' | 'strategy_problem' | 'foundation_problem';

export interface JudgeVerdictEscalate {
  verdict: 'ESCALATE';
  reason: string;
  diagnosis_hint: EscalationDiagnosisType;
  value_alignment?: ValueAlignmentStatus;
  value_notes?: string | null;
}

export type JudgeVerdict = JudgeVerdictAccept | JudgeVerdictRevise | JudgeVerdictEscalate;

export interface EscalationDiagnosis {
  type: EscalationDiagnosisType;
  action: Record<string, unknown>;
  reasoning: string;
  resolution?: {
    type: 'redispatched' | 'cancelled' | 'resolved_directly';
    note: string;
    resolved_at: string;
  };
}

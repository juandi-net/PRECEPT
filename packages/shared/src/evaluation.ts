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

export interface JudgeVerdictAccept {
  verdict: 'ACCEPT';
  assessment: string;
  criteria_met: string[];
}

export interface JudgeVerdictRevise {
  verdict: 'REVISE';
  feedback: string;
  criteria_failed: string[];
}

export type EscalationDiagnosisType = 'spec_problem' | 'capability_problem' | 'strategy_problem' | 'foundation_problem';

export interface JudgeVerdictEscalate {
  verdict: 'ESCALATE';
  reason: string;
  diagnosis_hint: EscalationDiagnosisType;
}

export type JudgeVerdict = JudgeVerdictAccept | JudgeVerdictRevise | JudgeVerdictEscalate;

export interface EscalationDiagnosis {
  type: EscalationDiagnosisType;
  action: Record<string, unknown>;
  reasoning: string;
}

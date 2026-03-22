/**
 * Zod schemas for all AI-generated response types.
 *
 * Each schema mirrors the corresponding TypeScript interface in @precept/shared
 * and is used by invokeAndValidate() for runtime validation of LLM output.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// WorkerOutput
// ---------------------------------------------------------------------------

const FieldSignalSchema = z.object({
  type: z.enum(['observation', 'contradiction', 'opportunity', 'risk']),
  content: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  relevant_to: z.string().optional(),
});

export const WorkerOutputSchema = z.object({
  output: z.string(),
  key_findings: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
  flag: z.string().nullable(),
  notes: z.string().nullable(),
  field_signals: z.array(FieldSignalSchema).optional().default([]),
});

// ---------------------------------------------------------------------------
// ReviewVerdict (discriminated union on `verdict`)
// ---------------------------------------------------------------------------

export const ReviewVerdictSchema = z.discriminatedUnion('verdict', [
  z.object({
    verdict: z.literal('POLISH'),
    feedback: z.string(),
    areas: z.array(z.string()),
  }),
  z.object({
    verdict: z.literal('GOOD'),
    notes: z.string(),
  }),
  z.object({
    verdict: z.literal('EXCELLENT'),
    commendation: z.string(),
    notes: z.string(),
  }),
]);

// ---------------------------------------------------------------------------
// JudgeVerdict (discriminated union on `verdict`)
// ---------------------------------------------------------------------------

const EscalationDiagnosisTypeSchema = z.enum([
  'spec_problem',
  'capability_problem',
  'strategy_problem',
  'foundation_problem',
]);

const ValueAlignmentSchema = z.enum(['aligned', 'drift_noted']).optional();
const ValueNotesSchema = z.string().nullable().optional();

export const JudgeVerdictSchema = z.discriminatedUnion('verdict', [
  z.object({
    verdict: z.literal('ACCEPT'),
    assessment: z.string(),
    criteria_met: z.array(z.string()),
    value_alignment: ValueAlignmentSchema,
    value_notes: ValueNotesSchema,
  }),
  z.object({
    verdict: z.literal('REVISE'),
    feedback: z.string(),
    criteria_failed: z.array(z.string()),
    value_alignment: ValueAlignmentSchema,
    value_notes: ValueNotesSchema,
  }),
  z.object({
    verdict: z.literal('ESCALATE'),
    reason: z.string(),
    diagnosis_hint: EscalationDiagnosisTypeSchema,
    value_alignment: ValueAlignmentSchema,
    value_notes: ValueNotesSchema,
  }),
]);

// ---------------------------------------------------------------------------
// PlanOutput (nested: Initiative > Phase > Task)
// ---------------------------------------------------------------------------

const PlanTaskSchema = z.object({
  id: z.string(),
  role: z.string(),
  title: z.string(),
  description: z.string(),
  acceptance_criteria: z.array(z.string()),
  depends_on: z.array(z.string()),
  priority: z.enum(['high', 'medium', 'low']),
  required_credentials: z.array(z.string()).optional(),
});

const PlanPhaseSchema = z.object({
  phase_number: z.number(),
  description: z.string(),
  tasks: z.array(PlanTaskSchema),
});

const PlanInitiativeSchema = z.object({
  name: z.string(),
  description: z.string(),
  rationale: z.string(),
  phases: z.array(PlanPhaseSchema),
});

const MonthlyPlanPhaseSchema = z.object({
  phase_number: z.number(),
  description: z.string(),
  goals: z.array(z.string()),
});

const MonthlyPlanInitiativeSchema = z.object({
  name: z.string(),
  description: z.string(),
  rationale: z.string(),
  phases: z.array(MonthlyPlanPhaseSchema),
});

const PlanDecisionSchema = z.object({
  decision: z.string(),
  reasoning: z.string(),
  alternatives: z.string(),
  why_not: z.string(),
});

const BoardRequestSchema = z.object({
  request: z.string(),
  context: z.string(),
  urgency: z.string(),
  fallback: z.string(),
});

export const PlanOutputSchema = z.object({
  initiatives: z.array(PlanInitiativeSchema),
  decisions: z.array(PlanDecisionSchema),
  board_requests: z.array(BoardRequestSchema),
});

export const MonthlyPlanOutputSchema = z.object({
  initiatives: z.array(MonthlyPlanInitiativeSchema),
  decisions: z.array(PlanDecisionSchema),
  board_requests: z.array(BoardRequestSchema),
});

// ---------------------------------------------------------------------------
// EscalationDiagnosis
// ---------------------------------------------------------------------------

export const EscalationDiagnosisSchema = z.object({
  type: EscalationDiagnosisTypeSchema,
  action: z.record(z.string(), z.unknown()),
  reasoning: z.string(),
});

// ---------------------------------------------------------------------------
// OwnerReplyIntent (actions is a discriminated union on `type`)
// ---------------------------------------------------------------------------

const OwnerReplyActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('approve'), target_id: z.string() }),
  z.object({ type: z.literal('hold'), target_id: z.string() }),
  z.object({ type: z.literal('pivot'), target_id: z.string(), direction: z.string() }),
  z.object({ type: z.literal('free_text'), content: z.string() }),
  z.object({ type: z.literal('clarify'), question: z.string() }),
]);

export const OwnerReplyIntentSchema = z.object({
  actions: z.array(OwnerReplyActionSchema),
  raw_text: z.string(),
  should_replan: z.boolean(),
});

// ---------------------------------------------------------------------------
// AdvisorOutput
// ---------------------------------------------------------------------------

export const AdvisorOutputSchema = z.object({
  verdict: z.enum(['APPROVED', 'APPROVED_WITH_CONCERNS', 'FLAGGED']),
  notes: z.string(),
});

// ---------------------------------------------------------------------------
// CuratorOutput
// ---------------------------------------------------------------------------

const CuratorActionSchema = z.object({
  type: z.enum(['create', 'refine', 'deprecate']),
  name: z.string(),
  scope: z.enum(['org_wide', 'role_specific']),
  role: z.string().nullable(),
  tags: z.array(z.string()),
  content: z.string().optional(),
});

export const CuratorOutputSchema = z.object({
  actions: z.array(CuratorActionSchema),
  reasoning: z.string(),
});

import { db } from './client.js';

export interface Decision {
  id: string;
  orgId: string;
  initiativeId: string | null;
  decision: string;
  reasoning: string;
  alternatives: string | null;
  whyNot: string | null;
  createdAt: string;
}

export interface DecisionParams {
  orgId: string;
  initiativeId?: string;
  decision: string;
  reasoning: string;
  alternatives?: string;
  whyNot?: string;
}

export interface Lesson {
  id: string;
  orgId: string;
  initiativeId: string | null;
  whatTried: string;
  whatHappened: string;
  why: string | null;
  whatLearned: string;
  doDifferently: string | null;
  neverRepeat: string | null;
  createdAt: string;
}

export interface LessonParams {
  orgId: string;
  initiativeId?: string;
  whatTried: string;
  whatHappened: string;
  why?: string;
  whatLearned: string;
  doDifferently?: string;
  neverRepeat?: string;
}

export async function logDecision(params: DecisionParams): Promise<void> {
  const { error } = await db
    .from('decision_log')
    .insert({
      org_id: params.orgId,
      initiative_id: params.initiativeId ?? null,
      decision: params.decision,
      reasoning: params.reasoning,
      alternatives: params.alternatives ?? null,
      why_not: params.whyNot ?? null,
    });

  if (error) throw new Error(`Failed to log decision: ${error.message}`);
}

export async function getRecentDecisions(orgId: string, limit = 10): Promise<Decision[]> {
  const { data, error } = await db
    .from('decision_log')
    .select()
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get recent decisions: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    orgId: row.org_id as string,
    initiativeId: (row.initiative_id as string) ?? null,
    decision: row.decision as string,
    reasoning: row.reasoning as string,
    alternatives: (row.alternatives as string) ?? null,
    whyNot: (row.why_not as string) ?? null,
    createdAt: row.created_at as string,
  }));
}

export async function logLesson(params: LessonParams): Promise<void> {
  const { error } = await db
    .from('lesson_artifacts')
    .insert({
      org_id: params.orgId,
      initiative_id: params.initiativeId ?? null,
      what_tried: params.whatTried,
      what_happened: params.whatHappened,
      why: params.why ?? null,
      what_learned: params.whatLearned,
      do_differently: params.doDifferently ?? null,
      never_repeat: params.neverRepeat ?? null,
    });

  if (error) throw new Error(`Failed to log lesson: ${error.message}`);
}

export async function getRecentLessons(orgId: string, limit = 10): Promise<Lesson[]> {
  const { data, error } = await db
    .from('lesson_artifacts')
    .select()
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get recent lessons: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    orgId: row.org_id as string,
    initiativeId: (row.initiative_id as string) ?? null,
    whatTried: row.what_tried as string,
    whatHappened: row.what_happened as string,
    why: (row.why as string) ?? null,
    whatLearned: row.what_learned as string,
    doDifferently: (row.do_differently as string) ?? null,
    neverRepeat: (row.never_repeat as string) ?? null,
    createdAt: row.created_at as string,
  }));
}

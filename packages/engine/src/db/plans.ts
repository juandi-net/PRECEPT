import { db } from './client.js';
import type { Plan, AdvisorVerdict, PlanOutput, MonthlyPlanOutput, PlanLevel } from '@precept/shared';

export interface CreatePlanParams {
  orgId: string;
  initiativeId?: string;
  content: PlanOutput | MonthlyPlanOutput;
  planLevel: PlanLevel;
  parentPlanId?: string | null;
}

function mapPlan(row: Record<string, unknown>): Plan {
  return {
    id: row.id as string,
    org_id: row.org_id as string,
    initiative_id: (row.initiative_id as string) ?? null,
    plan_level: (row.plan_level as PlanLevel) ?? 'weekly',
    parent_plan_id: (row.parent_plan_id as string) ?? null,
    content: row.content as PlanOutput | MonthlyPlanOutput,
    advisor_verdict: (row.advisor_verdict as AdvisorVerdict) ?? null,
    advisor_notes: (row.advisor_notes as string) ?? null,
    owner_approved: row.owner_approved as boolean,
    created_at: row.created_at as string,
  };
}

export async function createPlan(params: CreatePlanParams): Promise<Plan> {
  const { data, error } = await db
    .from('plans')
    .insert({
      org_id: params.orgId,
      initiative_id: params.initiativeId ?? null,
      plan_level: params.planLevel,
      parent_plan_id: params.parentPlanId ?? null,
      content: params.content,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create plan: ${error.message}`);
  return mapPlan(data);
}

export async function getPlan(planId: string): Promise<Plan | null> {
  const { data, error } = await db
    .from('plans')
    .select()
    .eq('id', planId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get plan: ${error.message}`);
  }
  return mapPlan(data);
}

export async function updateAdvisorVerdict(
  planId: string,
  verdict: AdvisorVerdict,
  notes: string
): Promise<void> {
  const { error } = await db
    .from('plans')
    .update({ advisor_verdict: verdict, advisor_notes: notes })
    .eq('id', planId);

  if (error) throw new Error(`Failed to update advisor verdict: ${error.message}`);
}

export async function approvePlan(planId: string): Promise<void> {
  const { error } = await db
    .from('plans')
    .update({ owner_approved: true })
    .eq('id', planId);

  if (error) throw new Error(`Failed to approve plan: ${error.message}`);
}

export async function getUnapprovedPlans(orgId: string): Promise<Plan[]> {
  const { data, error } = await db
    .from('plans')
    .select()
    .eq('org_id', orgId)
    .eq('owner_approved', false)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get unapproved plans: ${error.message}`);
  return (data ?? []).map(mapPlan);
}

export async function getLatestPlanByLevel(orgId: string, level: PlanLevel): Promise<Plan | null> {
  const { data, error } = await db
    .from('plans')
    .select()
    .eq('org_id', orgId)
    .eq('plan_level', level)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get latest ${level} plan: ${error.message}`);
  }
  return mapPlan(data);
}

export async function getPlanForCurrentMonth(orgId: string): Promise<Plan | null> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data, error } = await db
    .from('plans')
    .select()
    .eq('org_id', orgId)
    .eq('plan_level', 'monthly')
    .gte('created_at', monthStart)
    // Exclude plans stuck in FLAGGED state:
    // - is.null: not yet reviewed
    // - neq.FLAGGED: reviewed and not flagged (APPROVED or APPROVED_WITH_CONCERNS)
    // - owner_approved: flagged but owner resolved it
    // NOTE: PostgREST follows SQL NULL semantics — NULL != 'FLAGGED' is NULL, not true
    .or('advisor_verdict.is.null,advisor_verdict.neq.FLAGGED,owner_approved.eq.true')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get monthly plan for current month: ${error.message}`);
  }
  return mapPlan(data);
}

export async function getPlanForCurrentWeek(orgId: string): Promise<Plan | null> {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  weekStart.setHours(0, 0, 0, 0);
  const { data, error } = await db
    .from('plans')
    .select()
    .eq('org_id', orgId)
    .eq('plan_level', 'weekly')
    .gte('created_at', weekStart.toISOString())
    .or('advisor_verdict.is.null,advisor_verdict.neq.FLAGGED,owner_approved.eq.true')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get weekly plan for current week: ${error.message}`);
  }
  return mapPlan(data);
}

export async function getRecentAdhocPlan(orgId: string, withinMinutes: number): Promise<Plan | null> {
  const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
  const { data, error } = await db
    .from('plans')
    .select()
    .eq('org_id', orgId)
    .eq('plan_level', 'adhoc')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to check recent adhoc plan: ${error.message}`);
  }
  return mapPlan(data);
}

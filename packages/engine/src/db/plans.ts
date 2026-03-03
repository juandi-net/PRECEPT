import { db } from './client.js';
import type { Plan, AdvisorVerdict, PlanOutput } from '@precept/shared';

export interface CreatePlanParams {
  orgId: string;
  initiativeId?: string;
  content: PlanOutput;
}

function mapPlan(row: Record<string, unknown>): Plan {
  return {
    id: row.id as string,
    org_id: row.org_id as string,
    initiative_id: (row.initiative_id as string) ?? null,
    content: row.content as PlanOutput,
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

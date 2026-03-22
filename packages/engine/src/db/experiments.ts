import { db } from './client.js';

export interface CreateExperimentParams {
  orgId: string;
  initiativeId?: string;
  hypothesis: string;
  variants: string[];
  metric: string;
  sampleSize?: number;
  successThreshold?: number;
  createdBy: string;
}

export async function createExperiment(params: CreateExperimentParams) {
  const { data, error } = await db
    .from('experiments')
    .insert({
      org_id: params.orgId,
      initiative_id: params.initiativeId ?? null,
      hypothesis: params.hypothesis,
      variants: params.variants,
      metric: params.metric,
      sample_size: params.sampleSize ?? 3,
      success_threshold: params.successThreshold ?? 10.0,
      status: 'planned',
      created_by: params.createdBy,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create experiment: ${error.message}`);
  return data;
}

export async function getRunningExperiments(orgId: string) {
  const { data, error } = await db
    .from('experiments')
    .select()
    .eq('org_id', orgId)
    .eq('status', 'running');

  if (error) throw new Error(`Failed to get running experiments: ${error.message}`);
  return data ?? [];
}

export async function getActiveExperiment(orgId: string) {
  const { data, error } = await db
    .from('experiments')
    .select()
    .eq('org_id', orgId)
    .in('status', ['planned', 'running'])
    .limit(1);

  if (error) return null;
  return data?.[0] ?? null;
}

export async function concludeExperiment(
  experimentId: string,
  results: Record<string, unknown>
) {
  const { error } = await db
    .from('experiments')
    .update({
      status: 'concluded',
      results,
      concluded_at: new Date().toISOString(),
    })
    .eq('id', experimentId);

  if (error) throw new Error(`Failed to conclude experiment: ${error.message}`);
}

export async function startExperiment(experimentId: string) {
  const { error } = await db
    .from('experiments')
    .update({ status: 'running' })
    .eq('id', experimentId);

  if (error) throw new Error(`Failed to start experiment: ${error.message}`);
}

import { LinearClient } from '@linear/sdk';
import { resolveCredentials } from './credentials.js';
import { getTask } from '../db/tasks.js';
import { logEvent } from '../db/audit.js';
import type { AuditEventType } from '@precept/shared';

// Cache: orgId → { client, teamId }
const clientCache = new Map<string, { client: LinearClient; teamId: string }>();

async function getLinearClient(apiKey: string, orgId: string): Promise<{ client: LinearClient; teamId: string }> {
  const cached = clientCache.get(orgId);
  if (cached) return cached;

  const client = new LinearClient({ apiKey });
  const teams = await client.teams();
  const team = teams.nodes[0];
  if (!team) throw new Error('No Linear team found');

  const entry = { client, teamId: team.id };
  clientCache.set(orgId, entry);
  return entry;
}

export async function mirrorTaskCreated(
  apiKey: string,
  orgId: string,
  taskId: string,
  title: string,
  description: string,
): Promise<string | null> {
  try {
    const { client, teamId } = await getLinearClient(apiKey, orgId);
    const issue = await client.createIssue({
      teamId,
      title,
      description: description.slice(0, 10000),
    });
    const created = await issue.issue;
    if (!created) return null;
    console.log(`[linear] created issue ${created.identifier} for task ${taskId.slice(0, 8)}`);
    return created.id;
  } catch (err) {
    console.error(`[linear] mirror create failed for task ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export async function mirrorTaskAccepted(
  apiKey: string,
  orgId: string,
  linearIssueId: string,
  taskId: string,
  outputSummary: string,
): Promise<void> {
  try {
    const { client } = await getLinearClient(apiKey, orgId);

    // Get the "Done" state for this team
    const issue = await client.issue(linearIssueId);
    const team = await issue.team;
    if (!team) return;
    const states = await team.states();
    const doneState = states.nodes.find(s => s.type === 'completed');

    const updates: Record<string, unknown> = {};
    if (doneState) updates.stateId = doneState.id;
    if (outputSummary) updates.description = outputSummary.slice(0, 10000);

    await client.updateIssue(linearIssueId, updates);
    console.log(`[linear] marked issue done for task ${taskId.slice(0, 8)}`);
  } catch (err) {
    console.error(`[linear] mirror accept failed for task ${taskId.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Create a Linear issue (used by CEO tools).
 */
export async function createIssue(
  apiKey: string,
  teamId: string,
  params: { title: string; description?: string; priority?: number },
): Promise<{ id: string; identifier: string; url: string }> {
  const client = new LinearClient({ apiKey });
  const payload = await client.createIssue({
    teamId,
    title: params.title,
    description: params.description,
    priority: params.priority,
  });
  const issue = await payload.issue;
  if (!issue) throw new Error('Failed to create Linear issue');
  return { id: issue.id, identifier: issue.identifier, url: issue.url };
}

/**
 * Add a comment to a Linear issue (used by CEO tools).
 */
export async function addComment(
  apiKey: string,
  issueId: string,
  body: string,
): Promise<void> {
  const client = new LinearClient({ apiKey });
  await client.createComment({ issueId, body });
}

/**
 * Fire-and-forget helper: resolve credentials, look up the task's linear_issue_id,
 * and mark the Linear issue as done. Called from both judge-accepted and auto-accepted paths.
 */
export function fireLinearAcceptMirror(orgId: string, taskId: string, agentId: string): void {
  resolveCredentials(orgId).then(creds => {
    if (!creds.linearApiKey) return;
    getTask(taskId).then(task => {
      if (!task?.linear_issue_id) return;
      const summary = task.output?.output?.slice(0, 2000) ?? '';
      mirrorTaskAccepted(creds.linearApiKey!, orgId, task.linear_issue_id, taskId, summary);
      logEvent(orgId, 'linear.mirror_accepted' as AuditEventType, agentId, { taskId, linearIssueId: task.linear_issue_id });
    });
  }).catch(err => console.error(`[linear] accept mirror error: ${err instanceof Error ? err.message : String(err)}`));
}

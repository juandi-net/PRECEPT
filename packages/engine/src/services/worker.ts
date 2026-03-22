import type { Task, WorkerOutput } from '@precept/shared';
import { invokeAgent } from '../ai/invoke.js';
import { WorkerOutputSchema } from '../ai/schemas.js';
import type { ToolHandler } from '../ai/invoke.js';
import { buildWorkerSystemPrompt, buildWorkerUserMessage, buildWorkerReworkMessage } from '../ai/prompts/worker.js';
import { updateTaskOutput, updateTaskSkillsLoaded } from '../db/tasks.js';
import { logEvent } from '../db/audit.js';
import { logSkillEvent } from '../db/skill-events.js';
import { getSkillByName, getSkillIndexForWorker } from '../db/skills.js';
import { BASH_EXECUTE_TOOL, LOAD_SKILL_TOOL } from '../tools/types.js';
import { executeBash } from '../tools/bash-execute.js';
import { getOrCreateTaskWorkspace, cleanupTaskWorkspace } from '../tools/workspace.js';
import { resolveCredentials } from '../lib/credentials.js';
import { getAllOrgCredentials } from '../db/credentials.js';
import { embedText } from '../lib/embeddings.js';
import { matchRoleMemory } from '../db/role-memory.js';
import { getRoleSummary } from '../db/role-summaries.js';
import { getProfile } from '../db/agent-profiles.js';
import { getRecentBulletin } from '../db/team-bulletin.js';
import { roleRegistry } from '../config/role-registry.js';

export class WorkerService {
  /**
   * Execute a task. Invokes the AI worker, parses and stores the output.
   * The engine handles state transitions — this just produces the WorkerOutput.
   */
  async execute(task: Task): Promise<WorkerOutput> {
    const start = Date.now();
    const agentId = task.assigned_worker ?? `Worker-${task.role}-1`;
    const creds = await resolveCredentials(task.org_id);
    console.log(`[worker] starting task ${task.id.slice(0, 8)}...`);

    // Fetch skill index for system prompt (names + descriptions only)
    const skillIndex = await getSkillIndexForWorker(task.org_id, task.role);

    // Fetch role memory context (similar past findings for this role)
    let roleMemoryContext: Array<{ content: string; entryType: string; confidence: string }> = [];
    try {
      const queryEmbedding = await embedText(task.spec.description, 'query');
      const matches = await matchRoleMemory(task.org_id, task.role, queryEmbedding, 5);
      roleMemoryContext = matches.map(m => ({ content: m.content, entryType: m.entryType, confidence: m.confidence }));
    } catch (err) {
      console.warn(`[worker] role memory retrieval failed, continuing without: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Fetch role summary (baseline domain knowledge)
    const roleSummary = await getRoleSummary(task.org_id, task.role);

    // Fetch agent stats for self-awareness
    let agentStats: { tasksCompleted: number; acceptanceRate: number | null; recentTrend: string | null } | null = null;
    try {
      const profile = await getProfile(task.org_id, agentId);
      if (profile) {
        agentStats = {
          tasksCompleted: profile.tasksCompleted,
          acceptanceRate: profile.acceptanceRate,
          recentTrend: profile.recentTrend,
        };
      }
    } catch (err) {
      console.warn(`[worker] agent profile retrieval failed, continuing without: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Fetch recent organization activity for cross-role awareness
    let recentBulletin: Array<{ role: string; summary: string }> = [];
    try {
      const entries = await getRecentBulletin(task.org_id, 10);
      recentBulletin = entries.map(e => ({ role: e.role, summary: e.summary }));
    } catch (err) {
      console.warn(`[worker] bulletin retrieval failed, continuing without: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Track which skills the worker actually loads (for audit)
    const loadedSkills = new Set<string>();

    // Always provision both tools — load_skill for procedures, bash_execute for scripts
    const tools = [LOAD_SKILL_TOOL, BASH_EXECUTE_TOOL];

    // Fetch all org_credentials for env injection (not just required ones)
    const allOrgCredentials = await getAllOrgCredentials(task.org_id);

    const taskCredentials = Object.keys(allOrgCredentials).length > 0 ? allOrgCredentials : undefined;

    const toolHandler: ToolHandler = async (name: string, args: Record<string, unknown>) => {
      if (name === 'load_skill') {
        return this.handleLoadSkill(task.org_id, args.name as string, loadedSkills);
      }
      if (name === 'bash_execute') {
        const specWithWorkspace = task.spec as typeof task.spec & { workspace_path?: string };
        const workspaceDir = specWithWorkspace.workspace_path
          ?? (await getOrCreateTaskWorkspace(task.id, task.org_id)).workspaceDir;
        return executeBash({
          command: args.command as string,
          workspaceDir,
          taskId: task.id,
          orgId: task.org_id,
          githubToken: creds.githubToken,
          credentials: taskCredentials,
        });
      }
      return `Unknown tool: ${name}`;
    };

    try {
      const model = await roleRegistry.getModel(task.org_id, 'worker');
      const endpoint = await roleRegistry.getEndpoint(task.org_id, 'worker');
      const response = await invokeAgent(agentId, {
        orgId: task.org_id,
        model,
        endpoint,
        systemPrompt: buildWorkerSystemPrompt(task, skillIndex, roleMemoryContext, roleSummary, agentStats, recentBulletin),
        messages: [{ role: 'user', content: buildWorkerUserMessage(task) }],
        temperature: 0.5,
        jsonMode: true,
        tools,
        toolHandler,
      });

      const parsed = this.parseOutput(response.parsed, response.content, task.id);

      // Store output in task record
      await updateTaskOutput(task.id, parsed);

      // Write skills_loaded for audit (based on what the worker actually loaded)
      const skillsList = Array.from(loadedSkills);
      if (skillsList.length > 0) {
        await updateTaskSkillsLoaded(task.id, skillsList);
        // Log skill 'loaded' events for meta-learning
        for (const skillName of skillsList) {
          logSkillEvent({ orgId: task.org_id, skillName, eventType: 'loaded', metadata: { taskId: task.id, taskRole: task.role } });
        }
      }

      logEvent(task.org_id, 'worker.complete', agentId, {
        taskId: task.id,
        confidence: parsed.confidence,
        hasFlag: parsed.flag !== null,
        skillsLoaded: skillsList,
      });

      console.log(`[worker] task ${task.id.slice(0, 8)} done — loaded skills: [${skillsList.join(', ')}] (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      return parsed;
    } finally {
      // Only cleanup non-coder workspaces — coder worktrees are cleaned by engine on terminal state
      const specWithWorkspace = task.spec as typeof task.spec & { workspace_path?: string };
      if (!specWithWorkspace.workspace_path) {
        cleanupTaskWorkspace(task.id, task.org_id).catch(err =>
          console.error(`[worker] workspace cleanup failed: ${err instanceof Error ? err.message : String(err)}`)
        );
      }
    }
  }

  /**
   * Execute a rework pass. Invokes the AI worker with previous output + feedback.
   */
  async rework(task: Task, feedback: string, source: 'reviewer' | 'judge' | 'owner'): Promise<WorkerOutput> {
    const start = Date.now();
    const agentId = task.assigned_worker ?? `Worker-${task.role}-1`;
    const creds = await resolveCredentials(task.org_id);
    console.log(`[worker] starting rework for task ${task.id.slice(0, 8)} (${source} feedback)...`);

    // Fetch skill index for system prompt
    const skillIndex = await getSkillIndexForWorker(task.org_id, task.role);

    // Fetch role memory context (similar past findings for this role)
    let roleMemoryContext: Array<{ content: string; entryType: string; confidence: string }> = [];
    try {
      const queryEmbedding = await embedText(task.spec.description, 'query');
      const matches = await matchRoleMemory(task.org_id, task.role, queryEmbedding, 5);
      roleMemoryContext = matches.map(m => ({ content: m.content, entryType: m.entryType, confidence: m.confidence }));
    } catch (err) {
      console.warn(`[worker] role memory retrieval failed, continuing without: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Fetch role summary (baseline domain knowledge)
    const roleSummary = await getRoleSummary(task.org_id, task.role);

    // Fetch agent stats for self-awareness
    let agentStats: { tasksCompleted: number; acceptanceRate: number | null; recentTrend: string | null } | null = null;
    try {
      const profile = await getProfile(task.org_id, agentId);
      if (profile) {
        agentStats = {
          tasksCompleted: profile.tasksCompleted,
          acceptanceRate: profile.acceptanceRate,
          recentTrend: profile.recentTrend,
        };
      }
    } catch (err) {
      console.warn(`[worker] agent profile retrieval failed, continuing without: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Fetch recent organization activity for cross-role awareness
    let recentBulletin: Array<{ role: string; summary: string }> = [];
    try {
      const entries = await getRecentBulletin(task.org_id, 10);
      recentBulletin = entries.map(e => ({ role: e.role, summary: e.summary }));
    } catch (err) {
      console.warn(`[worker] bulletin retrieval failed, continuing without: ${err instanceof Error ? err.message : String(err)}`);
    }

    const loadedSkills = new Set<string>();
    const tools = [LOAD_SKILL_TOOL, BASH_EXECUTE_TOOL];

    // Fetch all org_credentials for env injection (not just required ones)
    const reworkAllOrgCredentials = await getAllOrgCredentials(task.org_id);

    const reworkTaskCredentials = Object.keys(reworkAllOrgCredentials).length > 0 ? reworkAllOrgCredentials : undefined;

    const toolHandler: ToolHandler = async (name: string, args: Record<string, unknown>) => {
      if (name === 'load_skill') {
        return this.handleLoadSkill(task.org_id, args.name as string, loadedSkills);
      }
      if (name === 'bash_execute') {
        const specWithWorkspace = task.spec as typeof task.spec & { workspace_path?: string };
        const workspaceDir = specWithWorkspace.workspace_path
          ?? (await getOrCreateTaskWorkspace(task.id, task.org_id)).workspaceDir;
        return executeBash({
          command: args.command as string,
          workspaceDir,
          taskId: task.id,
          orgId: task.org_id,
          githubToken: creds.githubToken,
          credentials: reworkTaskCredentials,
        });
      }
      return `Unknown tool: ${name}`;
    };

    try {
      const model = await roleRegistry.getModel(task.org_id, 'worker');
      const endpoint = await roleRegistry.getEndpoint(task.org_id, 'worker');
      const response = await invokeAgent(agentId, {
        orgId: task.org_id,
        model,
        endpoint,
        systemPrompt: buildWorkerSystemPrompt(task, skillIndex, roleMemoryContext, roleSummary, agentStats, recentBulletin),
        messages: [{ role: 'user', content: buildWorkerReworkMessage(task, feedback, source) }],
        temperature: 0.5,
        jsonMode: true,
        tools,
        toolHandler,
      });

      const parsed = this.parseOutput(response.parsed, response.content, task.id);

      await updateTaskOutput(task.id, parsed);

      const skillsList = Array.from(loadedSkills);
      if (skillsList.length > 0) {
        await updateTaskSkillsLoaded(task.id, skillsList);
        for (const skillName of skillsList) {
          logSkillEvent({
            orgId: task.org_id,
            skillName,
            eventType: 'loaded',
            metadata: { taskId: task.id, taskRole: task.role, rework: true },
          });
        }
      }

      logEvent(task.org_id, 'worker.rework_complete', agentId, {
        taskId: task.id,
        source,
        confidence: parsed.confidence,
        hasFlag: parsed.flag !== null,
        skillsLoaded: skillsList,
      });

      console.log(`[worker] rework ${task.id.slice(0, 8)} done — loaded skills: [${skillsList.join(', ')}] (${((Date.now() - start) / 1000).toFixed(1)}s)`);
      return parsed;
    } finally {
      // Only cleanup non-coder workspaces — coder worktrees are cleaned by engine on terminal state
      const specWithWorkspace = task.spec as typeof task.spec & { workspace_path?: string };
      if (!specWithWorkspace.workspace_path) {
        cleanupTaskWorkspace(task.id, task.org_id).catch(err =>
          console.error(`[worker] workspace cleanup failed: ${err instanceof Error ? err.message : String(err)}`)
        );
      }
    }
  }

  /**
   * Handle a load_skill tool call — reads skill content from the database
   * and returns it. Tracks which skills are loaded for audit.
   */
  private async handleLoadSkill(orgId: string, skillName: string, loadedSkills: Set<string>): Promise<string> {
    try {
      const skill = await getSkillByName(orgId, skillName);
      if (!skill?.content) {
        return 'Skill not found.';
      }

      loadedSkills.add(skillName);
      console.log(`[worker] loaded skill "${skillName}" (${skill.content.length} chars)`);
      return skill.content;
    } catch {
      return 'Skill not found.';
    }
  }

  /**
   * Parse worker output with fallback — if `output` field is missing but there's
   * substantive content, extract it rather than failing.
   */
  private parseOutput(
    parsed: Record<string, unknown> | undefined,
    rawContent: string,
    taskId: string
  ): WorkerOutput {
    // Tier 0: Zod schema validation — strict check
    if (parsed) {
      const result = WorkerOutputSchema.safeParse(parsed);
      if (result.success) return result.data;
      console.warn(`[worker] task ${taskId.slice(0, 8)}: schema validation failed, trying fallbacks: ${result.error.message}`);
    }

    // Tier 1 (existing): parsed JSON has output field — loose extraction
    if (parsed?.output) {
      return parsed as unknown as WorkerOutput;
    }

    // Fallback: parsed JSON exists but missing output — use largest string field
    if (parsed) {
      const stringFields = Object.entries(parsed)
        .filter(([, v]) => typeof v === 'string' && (v as string).length > 0)
        .sort(([, a], [, b]) => (b as string).length - (a as string).length);

      if (stringFields.length > 0) {
        const [fieldName, fieldValue] = stringFields[0];
        console.warn(`[worker] task ${taskId.slice(0, 8)}: missing 'output' field, falling back to '${fieldName}'`);
        return {
          output: fieldValue as string,
          key_findings: Array.isArray(parsed.key_findings) ? parsed.key_findings as string[] : [],
          confidence: (parsed.confidence as WorkerOutput['confidence']) ?? 'low',
          flag: typeof parsed.flag === 'string' ? parsed.flag : null,
          notes: typeof parsed.notes === 'string' ? parsed.notes : null,
        };
      }
    }

    // Last resort: raw content has substance — wrap it as output
    if (rawContent.trim().length > 50) {
      console.warn(`[worker] task ${taskId.slice(0, 8)}: JSON parsing failed, wrapping raw content as output`);
      return {
        output: rawContent.trim(),
        key_findings: [],
        confidence: 'low',
        flag: null,
        notes: 'Output recovered from raw LLM response — structured parsing failed.',
      };
    }

    // Truly invalid
    console.error(`[worker] task ${taskId.slice(0, 8)}: raw LLM response: ${rawContent.slice(0, 500)}`);
    throw new Error('Worker produced invalid output: missing output field and no fallback content');
  }
}

import type { Task, WorkerOutput } from '@precept/shared';
import { invokeAgent } from '../ai/invoke.js';
import { buildWorkerSystemPrompt, buildWorkerUserMessage, buildWorkerReworkMessage } from '../ai/prompts/worker.js';
import { updateTaskOutput } from '../db/tasks.js';
import { logEvent } from '../db/audit.js';

export class WorkerService {
  /**
   * Execute a task. Invokes the AI worker, parses and stores the output.
   * The engine handles state transitions — this just produces the WorkerOutput.
   */
  async execute(task: Task): Promise<WorkerOutput> {
    const start = Date.now();
    const agentId = task.assigned_worker ?? `Worker-${task.role}-1`;
    console.log(`[worker] starting task ${task.id.slice(0, 8)}...`);

    const response = await invokeAgent(agentId, {
      orgId: task.org_id,
      model: 'sonnet',
      systemPrompt: buildWorkerSystemPrompt(task),
      messages: [{ role: 'user', content: buildWorkerUserMessage(task) }],
      temperature: 0.5,
      jsonMode: true,
    });

    const parsed = this.parseOutput(response.parsed, response.content, task.id);

    // Store output in task record
    await updateTaskOutput(task.id, parsed);

    logEvent(task.org_id, 'worker.complete', agentId, {
      taskId: task.id,
      confidence: parsed.confidence,
      hasFlag: parsed.flag !== null,
    });

    console.log(`[worker] task ${task.id.slice(0, 8)} done (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    return parsed;
  }

  /**
   * Execute a rework pass. Invokes the AI worker with previous output + feedback.
   */
  async rework(task: Task, feedback: string, source: 'reviewer' | 'judge'): Promise<WorkerOutput> {
    const start = Date.now();
    const agentId = task.assigned_worker ?? `Worker-${task.role}-1`;
    console.log(`[worker] starting rework for task ${task.id.slice(0, 8)} (${source} feedback)...`);

    const response = await invokeAgent(agentId, {
      orgId: task.org_id,
      model: 'sonnet',
      systemPrompt: buildWorkerSystemPrompt(task),
      messages: [{ role: 'user', content: buildWorkerReworkMessage(task, feedback, source) }],
      temperature: 0.5,
      jsonMode: true,
    });

    const parsed = this.parseOutput(response.parsed, response.content, task.id);

    // Store revised output
    await updateTaskOutput(task.id, parsed);

    logEvent(task.org_id, 'worker.rework_complete', agentId, {
      taskId: task.id,
      source,
      confidence: parsed.confidence,
      hasFlag: parsed.flag !== null,
    });

    console.log(`[worker] rework ${task.id.slice(0, 8)} done (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    return parsed;
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
    // Happy path: parsed JSON has output field
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

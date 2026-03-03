import type { Task, WorkerOutput } from '@precept/shared';
import { invokeAgent } from '../ai/invoke.js';
import { buildWorkerSystemPrompt, buildWorkerUserMessage } from '../ai/prompts/worker.js';
import { updateTaskOutput } from '../db/tasks.js';
import { logEvent } from '../db/audit.js';

export class WorkerService {
  /**
   * Execute a task. Invokes the AI worker, parses and stores the output.
   * The engine handles state transitions — this just produces the WorkerOutput.
   */
  async execute(task: Task): Promise<WorkerOutput> {
    const agentId = task.assigned_worker ?? `Worker-${task.role}-1`;

    const response = await invokeAgent(agentId, {
      model: 'sonnet',
      systemPrompt: buildWorkerSystemPrompt(task),
      messages: [{ role: 'user', content: buildWorkerUserMessage(task) }],
      temperature: 0.5,
      jsonMode: true,
    });

    const parsed = response.parsed as unknown as WorkerOutput;
    if (!parsed?.output) {
      throw new Error('Worker produced invalid output: missing output field');
    }

    // Store output in task record
    await updateTaskOutput(task.id, parsed);

    logEvent('worker.complete', agentId, {
      taskId: task.id,
      confidence: parsed.confidence,
      hasFlag: parsed.flag !== null,
    });

    return parsed;
  }
}

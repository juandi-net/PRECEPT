import type { JudgeVerdict } from '@precept/shared';
import { invokeAndValidate, SchemaValidationError } from '../ai/validate.js';
import { JudgeVerdictSchema } from '../ai/schemas.js';
import { JUDGE_SYSTEM_PROMPT, buildJudgeMessage } from '../ai/prompts/judge.js';
import { getTask } from '../db/tasks.js';
import { getLatestCornerstone } from '../db/cornerstone.js';
import { logEvent } from '../db/audit.js';
import { roleRegistry } from '../config/role-registry.js';

export class JudgeService {
  async evaluate(taskId: string): Promise<JudgeVerdict> {
    const start = Date.now();
    console.log(`[judge] evaluating task ${taskId.slice(0, 8)}...`);

    const task = await getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (!task.output) throw new Error(`Task ${taskId} has no output — cannot judge`);

    // INVARIANT: Judge must not receive CEO planning rationale. See structure.md "Tiered Execution Model".
    // Judge context is limited to: worker output, acceptance criteria, task description, priority, worker confidence,
    // and Cornerstone values (for value-alignment checks).
    const cornerstone = await getLatestCornerstone(task.org_id);
    const cornerstoneContext = cornerstone ? {
      root: cornerstone.content.root?.content,
      constraints: cornerstone.content.constraints?.content,
      values: cornerstone.content.identity?.content,
    } : undefined;

    let verdict: JudgeVerdict;
    try {
      const model = await roleRegistry.getModel(task.org_id, 'judge');
      const endpoint = await roleRegistry.getEndpoint(task.org_id, 'judge');
      const result = await invokeAndValidate('Judge-1', {
        orgId: task.org_id,
        model,
        endpoint,
        systemPrompt: JUDGE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildJudgeMessage(task, cornerstoneContext) }],
        temperature: 0.4,
        jsonMode: true,
      }, JudgeVerdictSchema, 'judge verdict');
      verdict = result.data;
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        console.warn(`[judge] malformed verdict, defaulting to REVISE: ${err.message}`);
        verdict = { verdict: 'REVISE', feedback: 'Judge response was malformed — sending for re-review.', criteria_failed: [] };
      } else throw err;
    }

    logEvent(task.org_id, 'judge.verdict', 'Judge-1', {
      taskId,
      verdict: verdict.verdict,
    });

    console.log(`[judge] done — verdict: ${verdict.verdict} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    return verdict;
  }
}

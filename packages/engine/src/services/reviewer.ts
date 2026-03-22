import type { ReviewVerdict } from '@precept/shared';
import { invokeAndValidate, SchemaValidationError } from '../ai/validate.js';
import { ReviewVerdictSchema } from '../ai/schemas.js';
import { REVIEWER_SYSTEM_PROMPT, buildReviewerMessage } from '../ai/prompts/reviewer.js';
import { getTask } from '../db/tasks.js';
import { logEvent } from '../db/audit.js';
import { roleRegistry } from '../config/role-registry.js';

export class ReviewerService {
  async evaluate(taskId: string): Promise<ReviewVerdict> {
    const start = Date.now();
    console.log(`[reviewer] evaluating task ${taskId.slice(0, 8)}...`);

    const task = await getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (!task.output) throw new Error(`Task ${taskId} has no output — cannot review`);

    let verdict: ReviewVerdict;
    try {
      const model = await roleRegistry.getModel(task.org_id, 'reviewer');
      const endpoint = await roleRegistry.getEndpoint(task.org_id, 'reviewer');
      const result = await invokeAndValidate('Reviewer-1', {
        orgId: task.org_id,
        model,
        endpoint,
        systemPrompt: REVIEWER_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildReviewerMessage(task) }],
        temperature: 0.5,
        jsonMode: true,
      }, ReviewVerdictSchema, 'review verdict');
      verdict = result.data;
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        console.warn(`[reviewer] malformed verdict, defaulting to POLISH: ${err.message}`);
        verdict = { verdict: 'POLISH', feedback: 'Review response was malformed — please re-review.', areas: [] };
      } else throw err;
    }

    logEvent(task.org_id, 'review.verdict', 'Reviewer-1', {
      taskId,
      verdict: verdict.verdict,
    });

    console.log(`[reviewer] done — verdict: ${verdict.verdict} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    return verdict;
  }
}

import type { ReviewVerdict } from '@precept/shared';
import { invokeAgent } from '../ai/invoke.js';
import { REVIEWER_SYSTEM_PROMPT, buildReviewerMessage } from '../ai/prompts/reviewer.js';
import { getTask } from '../db/tasks.js';
import { logEvent } from '../db/audit.js';

export class ReviewerService {
  async evaluate(taskId: string): Promise<ReviewVerdict> {
    const start = Date.now();
    console.log(`[reviewer] evaluating task ${taskId.slice(0, 8)}...`);

    const task = await getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (!task.output) throw new Error(`Task ${taskId} has no output — cannot review`);

    const response = await invokeAgent('Reviewer-1', {
      orgId: task.org_id,
      model: 'opus',
      systemPrompt: REVIEWER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildReviewerMessage(task) }],
      temperature: 0.5,
      jsonMode: true,
    });

    const verdict = response.parsed as unknown as ReviewVerdict;
    if (!verdict?.verdict) {
      throw new Error('Reviewer produced invalid response: missing verdict');
    }

    logEvent(task.org_id, 'review.verdict', 'Reviewer-1', {
      taskId,
      verdict: verdict.verdict,
    });

    console.log(`[reviewer] done — verdict: ${verdict.verdict} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    return verdict;
  }
}

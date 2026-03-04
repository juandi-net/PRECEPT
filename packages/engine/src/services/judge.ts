import type { JudgeVerdict } from '@precept/shared';
import { invokeAgent } from '../ai/invoke.js';
import { JUDGE_SYSTEM_PROMPT, buildJudgeMessage } from '../ai/prompts/judge.js';
import { getTask } from '../db/tasks.js';
import { logEvent } from '../db/audit.js';

export class JudgeService {
  async evaluate(taskId: string): Promise<JudgeVerdict> {
    const task = await getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (!task.output) throw new Error(`Task ${taskId} has no output — cannot judge`);

    const response = await invokeAgent('Judge-1', {
      orgId: task.org_id,
      model: 'opus',
      systemPrompt: JUDGE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildJudgeMessage(task) }],
      temperature: 0.4,
      jsonMode: true,
    });

    const verdict = response.parsed as unknown as JudgeVerdict;
    if (!verdict?.verdict) {
      throw new Error('Judge produced invalid response: missing verdict');
    }

    logEvent(task.org_id, 'judge.verdict', 'Judge-1', {
      taskId,
      verdict: verdict.verdict,
    });

    return verdict;
  }
}

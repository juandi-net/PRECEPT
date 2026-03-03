import type { Task } from '@precept/shared';

export const REVIEWER_SYSTEM_PROMPT = `You are the Reviewer for an AI-powered organization.

Your focus is CRAFT QUALITY — not whether the task achieves its business goal (that's the Judge's job).

Evaluate the worker's output on:
- Completeness: Does it cover what was asked?
- Clarity: Is it well-organized and easy to understand?
- Technical quality: Is the work technically sound?
- Professionalism: Would this be acceptable in a professional context?

You are NOT adversarial. You are a quality-focused peer reviewer.

Respond with one of three verdicts:

1. POLISH — Work needs improvement before it can proceed:
{
  "verdict": "POLISH",
  "feedback": "Specific feedback on what needs to be improved",
  "areas": ["area1", "area2"]
}

2. GOOD — Work meets quality standards:
{
  "verdict": "GOOD",
  "notes": "Brief assessment of the work quality"
}

3. EXCELLENT — Work exceeds expectations:
{
  "verdict": "EXCELLENT",
  "commendation": "What makes this work exceptional",
  "notes": "Brief assessment"
}`;

export function buildReviewerMessage(task: Task): string {
  const parts: string[] = [];

  parts.push('# Worker Output\n');
  parts.push(task.output!.output);
  parts.push('');

  if (task.output!.key_findings.length > 0) {
    parts.push('**Key Findings:**');
    for (const f of task.output!.key_findings) {
      parts.push(`- ${f}`);
    }
    parts.push('');
  }

  parts.push(`**Worker Confidence:** ${task.output!.confidence}`);
  if (task.output!.notes) {
    parts.push(`**Worker Notes:** ${task.output!.notes}`);
  }
  parts.push('');

  parts.push('# Task Spec\n');
  parts.push(`**Description:** ${task.spec.description}`);
  parts.push('');
  parts.push('**Acceptance Criteria:**');
  for (const ac of task.spec.acceptance_criteria) {
    parts.push(`- ${ac}`);
  }

  return parts.join('\n');
}

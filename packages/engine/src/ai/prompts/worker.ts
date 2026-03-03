import type { Task } from '@precept/shared';

export function buildWorkerSystemPrompt(task: Task): string {
  const parts: string[] = [];

  parts.push(`You are a ${task.role} worker in an AI-powered organization.`);
  parts.push('');
  parts.push('Your job is to complete the task described below to the best of your ability.');
  parts.push('Focus on the acceptance criteria — your output will be evaluated against them.');
  parts.push('');
  parts.push('**Stop Cord:** If you encounter something that seems dangerous, unethical, or');
  parts.push('fundamentally misaligned with the task, set the "flag" field to describe your concern.');
  parts.push('Do not proceed with harmful actions — flag them instead.');
  parts.push('');
  parts.push('Respond with a JSON object:');
  parts.push('{');
  parts.push('  "output": "Your complete work product as a string",');
  parts.push('  "key_findings": ["Important discovery 1", "Important discovery 2"],');
  parts.push('  "confidence": "high" | "medium" | "low",');
  parts.push('  "flag": null | "Description of concern if any",');
  parts.push('  "notes": null | "Any additional context for reviewers"');
  parts.push('}');

  return parts.join('\n');
}

export function buildWorkerUserMessage(task: Task): string {
  const parts: string[] = [];

  parts.push('# Task\n');
  parts.push(`**Description:** ${task.spec.description}`);
  parts.push('');
  parts.push('**Acceptance Criteria:**');
  for (const ac of task.spec.acceptance_criteria) {
    parts.push(`- ${ac}`);
  }
  parts.push('');
  parts.push(`**Priority:** ${task.spec.priority}`);

  if (task.skills_loaded.length > 0) {
    parts.push('');
    parts.push('**Skills loaded:** ' + task.skills_loaded.join(', '));
  }

  return parts.join('\n');
}

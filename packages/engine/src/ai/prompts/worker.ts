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
  parts.push('You MUST respond with a JSON object containing exactly these fields:');
  parts.push('');
  parts.push('```json');
  parts.push('{');
  parts.push('  "output": "Your complete work product as a string (REQUIRED)",');
  parts.push('  "key_findings": ["Important discovery 1", "Important discovery 2"],');
  parts.push('  "confidence": "high",');
  parts.push('  "flag": null,');
  parts.push('  "notes": null');
  parts.push('}');
  parts.push('```');
  parts.push('');
  parts.push('- "output" (string, REQUIRED): Your complete work product.');
  parts.push('- "key_findings" (string[]): Important discoveries or results.');
  parts.push('- "confidence" ("high" | "medium" | "low"): Your confidence in the output.');
  parts.push('- "flag" (string | null): Set ONLY if you encounter something dangerous or unethical.');
  parts.push('- "notes" (string | null): Additional context for reviewers.');

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

export function buildWorkerReworkMessage(task: Task, feedback: string, source: 'reviewer' | 'judge'): string {
  const parts: string[] = [];

  parts.push('# Rework Required\n');
  parts.push(`The ${source} has requested revisions to your previous work on this task.\n`);

  parts.push('## Original Task\n');
  parts.push(`**Description:** ${task.spec.description}`);
  parts.push('');
  parts.push('**Acceptance Criteria:**');
  for (const ac of task.spec.acceptance_criteria) {
    parts.push(`- ${ac}`);
  }
  parts.push('');

  if (task.output) {
    parts.push('## Your Previous Output\n');
    parts.push(task.output.output);
    parts.push('');
  }

  parts.push(`## ${source === 'reviewer' ? 'Reviewer' : 'Judge'} Feedback\n`);
  parts.push(feedback);
  parts.push('');
  parts.push('Please revise your work to address the feedback above. Return the complete revised output, not just the changes.');

  return parts.join('\n');
}

import type { Task } from '@precept/shared';

export function buildWorkerSystemPrompt(
  task: Task,
  skillIndex: Array<{ name: string; description: string }>,
  roleMemory: Array<{ content: string; entryType: string; confidence: string }> = [],
  roleSummary: string | null = null,
  agentStats: { tasksCompleted: number; acceptanceRate: number | null; recentTrend: string | null } | null = null,
  recentBulletin: Array<{ role: string; summary: string }> = [],
): string {
  const parts: string[] = [];

  parts.push(`You are a ${task.role} worker in an AI-powered organization.`);
  parts.push('');
  parts.push('Your job is to complete the task described below to the best of your ability.');
  parts.push('Focus on the acceptance criteria — your output will be evaluated against them.');

  parts.push('');
  parts.push('**Tool Usage:** You have access to the `bash_execute` tool for running commands and scripts.');
  parts.push('When a skill procedure says to run a command, call bash_execute with that command.');
  parts.push('Do not describe what you would run — run it. Credentials are pre-configured.');
  parts.push('');
  parts.push('**Repository Visibility:** All GitHub repositories must be created as private. Never create public repositories.');

  // Role summary — baseline domain knowledge
  if (roleSummary) {
    parts.push('');
    parts.push('## Role Knowledge');
    parts.push('');
    parts.push(roleSummary);
  }

  // Agent stats — self-awareness for the worker
  if (agentStats) {
    parts.push('');
    parts.push('## Your Performance');
    parts.push('');
    const ratePart = agentStats.acceptanceRate !== null
      ? ` with ${agentStats.acceptanceRate}% acceptance rate`
      : '';
    const trendPart = agentStats.recentTrend
      ? ` (trend: ${agentStats.recentTrend})`
      : '';
    parts.push(`You have completed ${agentStats.tasksCompleted} tasks${ratePart}${trendPart}.`);
  }

  // Skill index — always present for worker autonomy
  if (skillIndex.length > 0) {
    parts.push('');
    parts.push('## Available Skills');
    parts.push('');
    parts.push('Review the skills below. If one is relevant to your task, call `load_skill` to get the full procedure before starting work. Follow the procedure exactly.');
    parts.push('');
    for (const skill of skillIndex) {
      parts.push(`- **${skill.name}**: ${skill.description || skill.name}`);
    }
  }

  // Role memory — past findings and patterns from similar tasks
  if (roleMemory.length > 0) {
    parts.push('');
    parts.push('## Role Memory');
    parts.push('');
    parts.push('Relevant findings and patterns from past tasks in your role. Use these to inform your work:');
    parts.push('');
    for (const entry of roleMemory) {
      const label = entry.entryType === 'craft_pattern' ? 'Pattern' : 'Finding';
      parts.push(`- **[${label}]** ${entry.content}`);
    }
  }

  // Recent organization activity — cross-role awareness
  if (recentBulletin.length > 0) {
    parts.push('');
    parts.push('## Recent Organization Activity');
    parts.push('');
    parts.push('Recent completed work across the organization:');
    parts.push('');
    for (const entry of recentBulletin) {
      parts.push(`- **[${entry.role}]** ${entry.summary}`);
    }
  }

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
  parts.push('  "notes": null,');
  parts.push('  "field_signals": []');
  parts.push('}');
  parts.push('```');
  parts.push('');
  parts.push('- "output" (string, REQUIRED): Your complete work product.');
  parts.push('- "key_findings" (string[]): Important discoveries or results.');
  parts.push('- "confidence" ("high" | "medium" | "low"): Your confidence in the output.');
  parts.push('- "flag" (string | null): Set ONLY if you encounter something dangerous or unethical.');
  parts.push('- "notes" (string | null): Additional context for reviewers.');
  parts.push('- "field_signals" (array, optional): Structured signals about things you noticed during work.');
  parts.push('  Each signal: { "type": "observation"|"contradiction"|"opportunity"|"risk", "content": "...", "confidence": "high"|"medium"|"low", "relevant_to": "..." }');
  parts.push('  Types: observation (notable finding), contradiction (conflicts with existing knowledge), opportunity (worth exploring), risk (potential problem).');
  parts.push('  Use field_signals to surface observations beyond your task scope — things the CEO should know about.');

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

  return parts.join('\n');
}

export function buildWorkerReworkMessage(task: Task, feedback: string, source: 'reviewer' | 'judge' | 'owner'): string {
  const parts: string[] = [];

  parts.push('# Rework Required\n');
  parts.push(`The ${source === 'owner' ? 'owner' : source} has requested revisions to your previous work on this task.\n`);

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

  parts.push(`## ${source === 'reviewer' ? 'Reviewer' : source === 'judge' ? 'Judge' : 'Owner'} Feedback\n`);
  parts.push(feedback);
  parts.push('');
  parts.push('Please revise your work to address the feedback above. Return the complete revised output, not just the changes.');

  return parts.join('\n');
}

import { describe, it, expect } from 'vitest';
import { buildWorkerSystemPrompt } from '../worker.js';
import type { Task } from '@precept/shared';

const baseTask: Task = {
  id: 'task-1',
  org_id: 'org-1',
  plan_id: null,
  initiative_id: null,
  phase: 1,
  state: 'IN_PROGRESS',
  role: 'researcher',
  assigned_worker: 'Worker-researcher-1',
  spec: {
    title: 'Test task',
    description: 'Test task',
    acceptance_criteria: ['criterion 1'],
    priority: 'medium',
  },
  output: null,
  skills_loaded: [],
  depends_on: [],
  revision_count: 0,
  polish_count: 0,
  source: 'planning_cycle',
  created_at: '2026-03-12T00:00:00Z',
  updated_at: null,
  linear_issue_id: null,
  escalation_diagnosis: null,
  owner_read_at: null,
};

describe('buildWorkerSystemPrompt', () => {
  it('includes agent stats when provided', () => {
    const prompt = buildWorkerSystemPrompt(
      baseTask,
      [],
      [],
      null,
      { tasksCompleted: 15, acceptanceRate: 87.5, recentTrend: 'improving' },
    );
    expect(prompt).toContain('## Your Performance');
    expect(prompt).toContain('15 tasks');
    expect(prompt).toContain('87.5%');
    expect(prompt).toContain('improving');
  });

  it('includes bulletin when provided', () => {
    const prompt = buildWorkerSystemPrompt(
      baseTask,
      [],
      [],
      null,
      null,
      [
        { role: 'coder', summary: 'Implemented auth module' },
        { role: 'researcher', summary: 'Analyzed competitor landscape' },
      ],
    );
    expect(prompt).toContain('## Recent Organization Activity');
    expect(prompt).toContain('[coder]');
    expect(prompt).toContain('Implemented auth module');
    expect(prompt).toContain('[researcher]');
  });

  it('omits sections when data is empty', () => {
    const prompt = buildWorkerSystemPrompt(baseTask, [], [], null, null, []);
    expect(prompt).not.toContain('## Your Performance');
    expect(prompt).not.toContain('## Recent Organization Activity');
  });

  it('places bulletin after role memory and before stop cord', () => {
    const prompt = buildWorkerSystemPrompt(
      baseTask,
      [],
      [{ content: 'past finding', entryType: 'finding', confidence: 'high' }],
      null,
      null,
      [{ role: 'coder', summary: 'Shipped feature X' }],
    );
    const roleMemoryIdx = prompt.indexOf('## Role Memory');
    const bulletinIdx = prompt.indexOf('## Recent Organization Activity');
    const stopCordIdx = prompt.indexOf('**Stop Cord:**');
    expect(roleMemoryIdx).toBeLessThan(bulletinIdx);
    expect(bulletinIdx).toBeLessThan(stopCordIdx);
  });
});

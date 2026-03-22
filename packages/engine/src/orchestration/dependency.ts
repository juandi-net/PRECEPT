import type { Task } from '@precept/shared';

/**
 * Returns tasks in PLANNED state where every dependency is ACCEPTED.
 * Pure function — no DB calls.
 */
export function getDispatchableTasks(tasks: Task[]): Task[] {
  const stateById = new Map(tasks.map((t) => [t.id, t.state]));

  return tasks.filter((task) => {
    if (task.state !== 'PLANNED') return false;
    return task.depends_on.every((depId) => stateById.get(depId) === 'ACCEPTED');
  });
}

/**
 * Returns true if every task in the given phase is ACCEPTED.
 * Empty phase returns true.
 */
export function checkPhaseCompletion(tasks: Task[], phase: number): boolean {
  const phaseTasks = tasks.filter((t) => t.phase === phase);
  return phaseTasks.every((t) => t.state === 'ACCEPTED');
}

/**
 * Builds adjacency list: taskId → [taskIds that depend on it].
 * Used for visualization / debugging.
 */
export function buildDependencyGraph(tasks: Task[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const task of tasks) {
    for (const depId of task.depends_on) {
      const existing = graph.get(depId) ?? [];
      existing.push(task.id);
      graph.set(depId, existing);
    }
  }
  return graph;
}

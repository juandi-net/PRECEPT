import type { Task, WorkerOutput } from '@precept/shared';
import type { EngineEvent } from '../engine.js';

export type WorkerMode =
  | { type: 'execute' }
  | { type: 'rework'; feedback: string; source: 'reviewer' | 'judge' | 'owner' };

export interface EngineContext {
  push(event: EngineEvent): void;
  runWorker(task: Task, orgId: string, mode: WorkerMode): Promise<WorkerOutput>;
  executeWorkerInBackground(task: Task, orgId: string, mode: WorkerMode, onComplete?: () => Promise<void>): void;
  dispatchReadyTasks(orgId: string, taskId: string): Promise<void>;
  cleanupWorkspaceIfNeeded(task: Task): Promise<void>;
}

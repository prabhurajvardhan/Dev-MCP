/**
 * Task DAG Scheduler: manages task dependencies, topological readiness, and task.next selection
 */
import { Task, TaskPriority } from '../models/task.js';
import { SQLiteStateStore } from '../storage/sqlite.js';
import { detectCycles, topologicalSort } from '../utils/dag.js';
import { Logger } from '../utils/logger.js';

const PRIORITY_SCORES: Record<TaskPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export class TaskScheduler {
  private logger = new Logger('TaskScheduler');

  constructor(private stateStore: SQLiteStateStore) {}

  /**
   * Evaluates all tasks in a project and promotes BLOCKED tasks to READY
   * if all their dependencies are in VERIFIED state.
   */
  updateTaskReadiness(projectId: string): Task[] {
    const tasks = this.stateStore.getTasksByProject(projectId);
    const taskMap = new Map<string, Task>();
    for (const t of tasks) {
      taskMap.set(t.id, t);
    }

    const updatedTasks: Task[] = [];

    for (const task of tasks) {
      if (task.state === 'BLOCKED') {
        const allDepsSatisfied = task.dependencies.every((depId) => {
          const depTask = taskMap.get(depId);
          return depTask && depTask.state === 'VERIFIED';
        });

        if (allDepsSatisfied) {
          const updated: Task = {
            ...task,
            state: 'READY',
            updatedAt: new Date().toISOString(),
          };
          this.stateStore.saveTask(updated);
          taskMap.set(updated.id, updated);
          updatedTasks.push(updated);
          this.logger.info(`Task ${task.id} ('${task.title}') dependencies satisfied -> Promoted to READY`);
        }
      }
    }

    return updatedTasks;
  }

  /**
   * Validates DAG consistency and detects any circular dependencies
   */
  validateDAG(projectId: string): { isValid: boolean; cyclePath?: string[] } {
    const tasks = this.stateStore.getTasksByProject(projectId);
    const dagNodes = tasks.map((t) => ({
      id: t.id,
      dependencies: t.dependencies,
    }));

    const result = detectCycles(dagNodes);
    return {
      isValid: !result.hasCycle,
      cyclePath: result.cyclePath,
    };
  }

  /**
   * Returns the next best task for a worker to claim.
   * Priority:
   * 1. High priority repair tasks in READY state
   * 2. Highest priority tasks in READY state
   * 3. Earliest created task
   */
  getNextTask(projectId: string, workerId?: string): Task | null {
    // First refresh readiness
    this.updateTaskReadiness(projectId);

    const tasks = this.stateStore.getTasksByProject(projectId);
    const readyTasks = tasks.filter((t) => t.state === 'READY');

    if (readyTasks.length === 0) {
      return null;
    }

    // Sort ready tasks
    readyTasks.sort((a, b) => {
      // Repair tasks first
      if (a.isRepairTask && !b.isRepairTask) return -1;
      if (!a.isRepairTask && b.isRepairTask) return 1;

      // Priority score descending
      const scoreA = PRIORITY_SCORES[a.priority];
      const scoreB = PRIORITY_SCORES[b.priority];
      if (scoreA !== scoreB) return scoreB - scoreA;

      // Earliest created first
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return readyTasks[0];
  }
}

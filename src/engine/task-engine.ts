/**
 * Task Engine: enforces strict state machine transitions, claim lifecycle,
 * completion gates, and automatic repair task generation.
 */
import { Task, TaskState, ALLOWED_TRANSITIONS } from '../models/task.js';
import { SQLiteStateStore } from '../storage/sqlite.js';
import { VibeFileStore } from '../storage/vibe-file-store.js';
import { VerificationEngine, GateVerificationOutcome } from './verification.js';
import { TaskScheduler } from './scheduler.js';
import { generateId, generateTimestamp } from '../utils/id-gen.js';
import { Logger } from '../utils/logger.js';

export interface TaskCompleteResult {
  success: boolean;
  task: Task;
  gateOutcome: GateVerificationOutcome;
  repairTask?: Task;
  error?: string;
}

export class TaskEngine {
  private logger = new Logger('TaskEngine');

  constructor(
    private stateStore: SQLiteStateStore,
    private verificationEngine: VerificationEngine,
    private scheduler: TaskScheduler,
    private vibeFileStore?: VibeFileStore
  ) {}

  /**
   * Enforces valid state machine transition
   */
  transition(task: Task, newState: TaskState): Task {
    const allowed = ALLOWED_TRANSITIONS[task.state];
    if (!allowed || !allowed.includes(newState)) {
      throw new Error(
        `Illegal state transition: Cannot transition task ${task.id} from ${task.state} to ${newState}. Allowed transitions: ${allowed?.join(', ') || 'none'}`
      );
    }

    const updated: Task = {
      ...task,
      state: newState,
      updatedAt: generateTimestamp(),
      completedAt: newState === 'VERIFIED' ? generateTimestamp() : task.completedAt,
    };

    this.stateStore.saveTask(updated);
    if (this.vibeFileStore) {
      this.vibeFileStore.syncTasks(this.stateStore.getTasksByProject(task.projectId));
    }

    this.logger.info(`Task ${task.id} transitioned from ${task.state} to ${newState}`);
    return updated;
  }

  /**
   * Worker claims a READY task
   */
  claimTask(taskId: string, workerId: string): Task {
    const task = this.stateStore.getTask(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    if (task.state !== 'READY') {
      throw new Error(`Cannot claim task ${taskId}: Current state is ${task.state}, expected READY`);
    }

    const claimed: Task = {
      ...task,
      state: 'CLAIMED',
      assignedWorkerId: workerId,
      claimedAt: generateTimestamp(),
      updatedAt: generateTimestamp(),
    };

    this.stateStore.saveTask(claimed);
    if (this.vibeFileStore) {
      this.vibeFileStore.syncTasks(this.stateStore.getTasksByProject(task.projectId));
    }

    this.logger.info(`Worker ${workerId} claimed task ${taskId}`);
    return claimed;
  }

  /**
   * Worker starts building a CLAIMED task
   */
  startBuilding(taskId: string): Task {
    const task = this.stateStore.getTask(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    return this.transition(task, 'BUILDING');
  }

  /**
   * Worker attempts to complete a task. Runs the Completion Gate!
   */
  async completeTask(
    taskId: string,
    options: {
      workerId?: string;
      cwd?: string;
      customTestCommand?: string;
    } = {}
  ): Promise<TaskCompleteResult> {
    const task = this.stateStore.getTask(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    // Must be in BUILDING or CLAIMED state (if claimed, transition to building first)
    let currentTask = task;
    if (currentTask.state === 'CLAIMED') {
      currentTask = this.transition(currentTask, 'BUILDING');
    }

    if (currentTask.state !== 'BUILDING' && currentTask.state !== 'VERIFYING') {
      throw new Error(
        `Cannot complete task ${taskId}: State must be BUILDING or VERIFYING (currently ${currentTask.state})`
      );
    }

    // Move to VERIFYING
    if (currentTask.state === 'BUILDING') {
      currentTask = this.transition(currentTask, 'VERIFYING');
    }

    // Execute the Completion Gate
    const gateOutcome = await this.verificationEngine.runCompletionGate(currentTask, options);

    if (gateOutcome.passed) {
      // Transition to VERIFIED
      const verifiedTask = this.transition(currentTask, 'VERIFIED');
      
      // Update DAG: promote any tasks that were waiting on this one
      this.scheduler.updateTaskReadiness(task.projectId);

      this.logger.info(`Task ${taskId} passed completion gate and reached VERIFIED status!`);
      return {
        success: true,
        task: verifiedTask,
        gateOutcome,
      };
    } else {
      // Verification FAILED! Do NOT mark VERIFIED!
      const failedTask = this.transition(currentTask, 'FAILED');

      // Create an automatic REPAIR TASK in state READY
      const repairTaskId = generateId('task-repair');
      const repairTask: Task = {
        id: repairTaskId,
        projectId: task.projectId,
        title: `Repair: Fix failure in '${task.title}'`,
        description: `Automated repair task generated due to verification failure: ${gateOutcome.failures.join('; ')}`,
        state: 'READY',
        priority: 'CRITICAL',
        dependencies: [],
        assignedWorkerId: null,
        claimedAt: null,
        moduleId: task.moduleId,
        contractSpec: task.contractSpec,
        isRepairTask: true,
        originalFailingTaskId: task.id,
        repairContext: {
          failureReason: gateOutcome.failures.join('; '),
          failingCommand: gateOutcome.failingCommand,
          stdout: gateOutcome.evidence?.stdout,
          stderr: gateOutcome.evidence?.stderr || gateOutcome.failures.join('\n'),
          affectedFiles: gateOutcome.changedFiles,
          suggestedAction: gateOutcome.suggestedAction || 'Review error logs and fix implementation',
        },
        createdAt: generateTimestamp(),
        updatedAt: generateTimestamp(),
        completedAt: null,
      };

      this.stateStore.saveTask(repairTask);
      if (this.vibeFileStore) {
        this.vibeFileStore.syncTasks(this.stateStore.getTasksByProject(task.projectId));
      }

      this.logger.warn(`Task ${taskId} failed verification. Created Repair Task ${repairTaskId}`);

      return {
        success: false,
        task: failedTask,
        gateOutcome,
        repairTask,
        error: `Verification gate failed: ${gateOutcome.failures.join('; ')}`,
      };
    }
  }

  /**
   * Explicitly fail a task
   */
  failTask(taskId: string, reason: string): Task {
    const task = this.stateStore.getTask(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    const failed = this.transition(task, 'FAILED');
    return failed;
  }
}

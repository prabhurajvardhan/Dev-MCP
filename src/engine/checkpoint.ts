/**
 * Checkpoint and Project Resume Engine
 */
import { Checkpoint, CheckpointSchema, ResumeContext } from '../models/checkpoint.js';
import { SQLiteStateStore } from '../storage/sqlite.js';
import { VibeFileStore } from '../storage/vibe-file-store.js';
import { GitManager } from '../execution/git-manager.js';
import { TaskScheduler } from './scheduler.js';
import { generateId, generateTimestamp } from '../utils/id-gen.js';
import { Logger } from '../utils/logger.js';

export class CheckpointManager {
  private logger = new Logger('CheckpointManager');

  constructor(
    private stateStore: SQLiteStateStore,
    private gitManager: GitManager,
    private scheduler: TaskScheduler,
    private vibeFileStore?: VibeFileStore
  ) {}

  async createCheckpoint(
    projectId: string,
    options: {
      summary?: string;
      cwd?: string;
    } = {}
  ): Promise<Checkpoint> {
    const project = this.stateStore.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Refresh task DAG states
    this.scheduler.updateTaskReadiness(projectId);

    const tasks = this.stateStore.getTasksByProject(projectId);
    const verifiedTasks = tasks.filter((t) => t.state === 'VERIFIED');
    const activeTasks = tasks.filter((t) => t.state === 'CLAIMED' || t.state === 'BUILDING' || t.state === 'VERIFYING');
    const readyTasks = tasks.filter((t) => t.state === 'READY');
    const blockedTasks = tasks.filter((t) => t.state === 'BLOCKED');

    // Get current Git commit SHA
    const gitCommitSha = await this.gitManager.getCurrentCommitSha(options.cwd);

    // Get verified capabilities (from verified tasks and modules)
    const verifiedCapabilities = verifiedTasks.map((t) => `${t.title} [${t.id}]`);

    // Worker assignments
    const workerAssignments: Record<string, string> = {};
    for (const t of activeTasks) {
      if (t.assignedWorkerId) {
        workerAssignments[t.assignedWorkerId] = t.id;
      }
    }

    // Recent command logs and observations
    const recentLogs = this.stateStore.getRecentCommandLogs(projectId, 10);
    const runtimeCommands = recentLogs.map((l) => l.command);

    // Failures
    const failedTasks = tasks.filter((t) => t.state === 'FAILED' || t.isRepairTask);
    const failures = failedTasks.map((f) => ({
      taskId: f.id,
      title: f.title,
      reason: f.repairContext?.failureReason || 'Failed verification',
    }));

    // Next recommended action
    let nextRecommendedAction = 'All current tasks complete. Plan next capability.';
    if (readyTasks.length > 0) {
      const nextTask = readyTasks[0];
      nextRecommendedAction = `Claim and implement READY task '${nextTask.title}' (${nextTask.id})`;
    } else if (activeTasks.length > 0) {
      const active = activeTasks[0];
      nextRecommendedAction = `Complete ongoing task '${active.title}' (${active.id})`;
    } else if (blockedTasks.length > 0) {
      nextRecommendedAction = `Unblock dependencies for ${blockedTasks[0].title}`;
    }

    const checkpointId = generateId('chk');
    const checkpoint: Checkpoint = CheckpointSchema.parse({
      id: checkpointId,
      projectId,
      gitCommitSha,
      phase: project.currentPhase,
      summary: options.summary || `Checkpoint at commit ${gitCommitSha.slice(0, 8)}: ${verifiedTasks.length} verified tasks`,
      verifiedCapabilities,
      activeTasks: activeTasks.map((t) => t.id),
      readyTasks: readyTasks.map((t) => t.id),
      blockedTasks: blockedTasks.map((t) => t.id),
      workerAssignments,
      workspaceInfo: { rootPath: project.rootPath },
      latestObservations: recentLogs.slice(0, 5),
      failures,
      architectureDecisions: [],
      interfaceVersions: { 'vibe-mcp-engine': '0.1.0' },
      integrationStatus: failures.length > 0 ? 'NEEDS_REPAIR' : 'HEALTHY',
      nextRecommendedAction,
      runtimeCommands,
      filesTouched: [],
      createdAt: generateTimestamp(),
    });

    this.stateStore.saveCheckpoint(checkpoint);
    if (this.vibeFileStore) {
      this.vibeFileStore.syncCheckpoint(checkpoint);
    }

    this.logger.info(`Created checkpoint ${checkpointId} for project ${projectId}`);
    return checkpoint;
  }

  loadCheckpoint(checkpointId: string): Checkpoint | null {
    return this.stateStore.getCheckpoint(checkpointId);
  }

  getLatestCheckpoint(projectId: string): Checkpoint | null {
    return this.stateStore.getLatestCheckpoint(projectId);
  }

  /**
   * Generates high-density continuation context for a completely fresh LLM
   */
  resumeProject(projectId: string): ResumeContext {
    const project = this.stateStore.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    this.scheduler.updateTaskReadiness(projectId);

    const latestCheckpoint = this.getLatestCheckpoint(projectId);
    const tasks = this.stateStore.getTasksByProject(projectId);
    const readyTasks = tasks.filter((t) => t.state === 'READY');
    const activeTasks = tasks.filter((t) => t.state === 'CLAIMED' || t.state === 'BUILDING' || t.state === 'VERIFYING');
    const verifiedTasks = tasks.filter((t) => t.state === 'VERIFIED');
    const failedTasks = tasks.filter((t) => t.state === 'FAILED' || t.isRepairTask);

    const nextAction = readyTasks.length > 0
      ? `Claim and execute task ${readyTasks[0].id}: "${readyTasks[0].title}"`
      : 'All current tasks complete. Check requirements and propose next vertical slice.';

    return {
      projectId,
      checkpointId: latestCheckpoint?.id || 'none',
      gitCommitSha: latestCheckpoint?.gitCommitSha || 'initial',
      currentPhase: project.currentPhase,
      completedCapabilities: verifiedTasks.map((t) => `[VERIFIED] ${t.title}`),
      readyTasks: readyTasks.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        description: t.description,
      })),
      activeTasks: activeTasks.map((t) => ({
        id: t.id,
        title: t.title,
        assignedWorkerId: t.assignedWorkerId,
      })),
      recentFailures: failedTasks.map((f) => ({
        taskId: f.id,
        title: f.title,
        repairContext: f.repairContext,
      })),
      nextRecommendedAction: nextAction,
      instructionsForWorker:
        'You are an interchangeable intelligence worker operating within VIBE ENGINEERING MCP. ' +
        'MCP is your operating system. Check the readyTasks list, claim the highest priority task using task.claim, ' +
        'write or modify files, execute verification commands via terminal.exec or module.run, and call task.complete ' +
        'to submit your work to the Verification Gate. Never assume a task is complete without verified observable evidence.',
    };
  }
}

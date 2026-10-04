/**
 * Project Engine: coordinates high-level project lifecycle, requirements compilation,
 * architecture generation & validation, and operational state inspection.
 */
import path from 'node:path';
import { Project, ProjectSchema } from '../models/project.js';
import { SQLiteStateStore } from '../storage/sqlite.js';
import { VibeFileStore } from '../storage/vibe-file-store.js';
import { GitManager } from '../execution/git-manager.js';
import { CheckpointManager } from './checkpoint.js';
import { TaskScheduler } from './scheduler.js';
import { generateId, generateTimestamp } from '../utils/id-gen.js';
import { Logger } from '../utils/logger.js';

export interface ProjectInspectResult {
  project: Project;
  gitBranch: string;
  gitCommitSha: string;
  taskCounts: {
    total: number;
    blocked: number;
    ready: number;
    claimed: number;
    building: number;
    verifying: number;
    verified: number;
    failed: number;
  };
  modulesCount: number;
  latestCheckpointSummary?: string;
  nextRecommendedAction: string;
}

export class ProjectEngine {
  private logger = new Logger('ProjectEngine');

  constructor(
    private stateStore: SQLiteStateStore,
    private vibeFileStore: VibeFileStore,
    private gitManager: GitManager,
    private checkpointManager: CheckpointManager,
    private scheduler: TaskScheduler
  ) {}

  /**
   * Initializes a project
   */
  async initializeProject(
    name: string,
    description: string,
    rootPath: string = process.cwd(),
    initialPhase: string = 'V0_FOUNDATION'
  ): Promise<Project> {
    const existing = this.stateStore.getAllProjects().find((p) => p.name === name);
    if (existing) {
      this.logger.info(`Project '${name}' already exists with ID ${existing.id}`);
      return existing;
    }

    const projectId = generateId('prj');
    const timestamp = generateTimestamp();

    const project: Project = ProjectSchema.parse({
      id: projectId,
      name,
      description,
      rootPath: path.resolve(rootPath),
      status: 'ACTIVE',
      currentPhase: initialPhase,
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: {},
    });

    this.stateStore.saveProject(project);
    this.vibeFileStore.syncProject(project);

    this.logger.info(`Initialized project '${name}' (${projectId}) at ${project.rootPath}`);
    return project;
  }

  /**
   * Inspects current operational snapshot
   */
  async inspectProject(projectId: string): Promise<ProjectInspectResult> {
    const project = this.stateStore.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    this.scheduler.updateTaskReadiness(projectId);

    const tasks = this.stateStore.getTasksByProject(projectId);
    const modules = this.stateStore.getModulesByProject(projectId);
    const latestCheckpoint = this.checkpointManager.getLatestCheckpoint(projectId);
    const gitBranch = await this.gitManager.getCurrentBranch();
    const gitCommitSha = await this.gitManager.getCurrentCommitSha();

    const taskCounts = {
      total: tasks.length,
      blocked: tasks.filter((t) => t.state === 'BLOCKED').length,
      ready: tasks.filter((t) => t.state === 'READY').length,
      claimed: tasks.filter((t) => t.state === 'CLAIMED').length,
      building: tasks.filter((t) => t.state === 'BUILDING').length,
      verifying: tasks.filter((t) => t.state === 'VERIFYING').length,
      verified: tasks.filter((t) => t.state === 'VERIFIED').length,
      failed: tasks.filter((t) => t.state === 'FAILED').length,
    };

    const ready = tasks.filter((t) => t.state === 'READY');
    const nextRecommendedAction = ready.length > 0
      ? `Execute next READY task: ${ready[0].title} (${ready[0].id})`
      : 'All current tasks complete. Resume or create next development milestone.';

    return {
      project,
      gitBranch,
      gitCommitSha,
      taskCounts,
      modulesCount: modules.length,
      latestCheckpointSummary: latestCheckpoint?.summary,
      nextRecommendedAction,
    };
  }

  /**
   * Compiles requirements into structured capabilities
   */
  compileRequirements(
    projectId: string,
    spec: {
      title: string;
      goals: string[];
      capabilities: Array<{ id: string; name: string; acceptanceCriteria: string[] }>;
    }
  ) {
    this.vibeFileStore.syncRequirements(spec);
    return {
      success: true,
      compiledAt: generateTimestamp(),
      capabilitiesCount: spec.capabilities.length,
    };
  }

  /**
   * Generates architecture artifacts
   */
  generateArchitecture(
    projectId: string,
    arch: {
      systemDesign: string;
      modules: Array<{ id: string; name: string; observableType: string; entrypoint: string }>;
      interfaces: Array<{ id: string; name: string; contract: string }>;
      dependencies: Array<{ from: string; to: string }>;
    }
  ) {
    this.vibeFileStore.syncArchitecture(arch);
    return {
      success: true,
      generatedAt: generateTimestamp(),
      modulesDefined: arch.modules.length,
    };
  }

  /**
   * Validates architecture consistency
   */
  validateArchitecture(projectId: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const dagResult = this.scheduler.validateDAG(projectId);
    if (!dagResult.isValid) {
      errors.push(`Cycle detected in task dependencies: ${dagResult.cyclePath?.join(' -> ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Workspace Manager: isolates worker tasks using dedicated Git worktrees
 * Strictly prevents fallback to project root.
 */
import fs from 'node:fs';
import path from 'node:path';
import { GitManager } from './git-manager.js';
import { CommandRunner } from './command-runner.js';
import { PathPolicy } from '../security/path-policy.js';
import { Logger } from '../utils/logger.js';

export interface WorkspaceInfo {
  workspaceId: string;
  workerId: string;
  taskId: string;
  branchName: string;
  worktreePath: string;
  workspacePath: string; // for backward compatibility
  repositoryPath: string;
  isIsolatedBranch: boolean;
  status: 'ACTIVE' | 'CLEANED' | 'FAILED';
  createdAt: string;
}

export class WorkspaceManager {
  private logger = new Logger('WorkspaceManager');
  private pathPolicy: PathPolicy;
  private workspaces = new Map<string, WorkspaceInfo>();

  constructor(
    private projectRoot: string,
    private gitManager: GitManager,
    private commandRunner?: CommandRunner
  ) {
    this.pathPolicy = new PathPolicy(projectRoot);
  }

  /**
   * Creates an isolated Git worktree for a worker and task.
   * NEVER falls back to project root. Throws an explicit error on failure.
   */
  async createWorkspace(workerId: string, taskId: string): Promise<WorkspaceInfo> {
    const sanitizedWorker = workerId.replace(/[^a-zA-Z0-9_-]/g, '-');
    const sanitizedTask = taskId.replace(/[^a-zA-Z0-9_-]/g, '-');
    const workspaceId = `ws-${sanitizedWorker}-${sanitizedTask}`;
    const branchName = `worker/${sanitizedWorker}/task-${sanitizedTask}`;
    
    const worktreeBase = path.join(this.projectRoot, '.worktrees');
    const worktreePath = path.join(worktreeBase, workspaceId);

    // If already created and active, return existing
    const existing = this.workspaces.get(workspaceId);
    if (existing && fs.existsSync(existing.worktreePath)) {
      return existing;
    }

    if (!fs.existsSync(worktreeBase)) {
      fs.mkdirSync(worktreeBase, { recursive: true });
    }

    // Check if worktree directory already exists (e.g. from previous run)
    if (fs.existsSync(worktreePath)) {
      try {
        await this.gitManager.removeWorktree(worktreePath);
      } catch {
        fs.rmSync(worktreePath, { recursive: true, force: true });
      }
    }

    // Create the worktree on a dedicated branch
    const cmdRunner = this.commandRunner || new CommandRunner(this.projectRoot);
    
    // Check if branch already exists
    const checkBranch = await cmdRunner.execute(`git rev-parse --verify "${branchName}"`, {
      cwd: this.projectRoot,
    });

    let addWorktreeCmd: string;
    if (checkBranch.exitCode === 0) {
      // Branch exists, checkout to worktree
      addWorktreeCmd = `git worktree add "${worktreePath}" "${branchName}"`;
    } else {
      // Create new branch at HEAD
      addWorktreeCmd = `git worktree add -b "${branchName}" "${worktreePath}" HEAD`;
    }

    const res = await cmdRunner.execute(addWorktreeCmd, {
      cwd: this.projectRoot,
    });

    if (res.exitCode !== 0) {
      this.logger.error(`Worktree creation failed: ${res.stderr || res.stdout}`);
      throw new Error(
        `Failed to create isolated Git worktree at '${worktreePath}': ${res.stderr || res.stdout}. Unsafe fallback to project root is forbidden.`
      );
    }

    const info: WorkspaceInfo = {
      workspaceId,
      workerId,
      taskId,
      branchName,
      worktreePath,
      workspacePath: worktreePath,
      repositoryPath: this.projectRoot,
      isIsolatedBranch: true,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    this.workspaces.set(workspaceId, info);
    this.logger.info(`Created isolated Git worktree ${workspaceId} at ${worktreePath}`);
    return info;
  }

  async cleanupWorkspace(workspaceId: string): Promise<boolean> {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) return false;

    try {
      await this.gitManager.removeWorktree(ws.worktreePath);
      ws.status = 'CLEANED';
      this.logger.info(`Cleaned up worktree ${workspaceId}`);
      return true;
    } catch (err) {
      this.logger.warn(`Failed to cleanly remove worktree ${workspaceId}:`, err);
      if (fs.existsSync(ws.worktreePath)) {
        fs.rmSync(ws.worktreePath, { recursive: true, force: true });
      }
      ws.status = 'CLEANED';
      return true;
    }
  }

  getWorkspace(workspaceId: string): WorkspaceInfo | null {
    return this.workspaces.get(workspaceId) ?? null;
  }

  getWorkspaceForTask(taskId: string): WorkspaceInfo | null {
    for (const ws of this.workspaces.values()) {
      if (ws.taskId === taskId && ws.status === 'ACTIVE') return ws;
    }
    return null;
  }

  getAllWorkspaces(): WorkspaceInfo[] {
    return Array.from(this.workspaces.values());
  }
}

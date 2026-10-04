/**
 * Workspace Manager: isolates worker tasks using dedicated branches / directories
 */
import fs from 'node:fs';
import path from 'node:path';
import { GitManager } from './git-manager.js';
import { PathPolicy } from '../security/path-policy.js';
import { Logger } from '../utils/logger.js';

export interface WorkspaceInfo {
  workspaceId: string;
  workerId: string;
  taskId: string;
  branchName: string;
  workspacePath: string;
  isIsolatedBranch: boolean;
  createdAt: string;
}

export class WorkspaceManager {
  private logger = new Logger('WorkspaceManager');
  private pathPolicy: PathPolicy;
  private workspaces = new Map<string, WorkspaceInfo>();

  constructor(
    private projectRoot: string,
    private gitManager: GitManager
  ) {
    this.pathPolicy = new PathPolicy(projectRoot);
  }

  async createWorkspace(workerId: string, taskId: string): Promise<WorkspaceInfo> {
    const workspaceId = `ws-${workerId}-${taskId.replace(/[^a-zA-Z0-9-]/g, '')}`;
    const branchName = `worker/${workerId}/task-${taskId}`;
    
    // In V0, use dedicated branch in the project root or sub-workspace folder
    const safeRoot = this.pathPolicy.getProjectRoot();
    
    // Try creating branch
    let isIsolatedBranch = true;
    try {
      await this.gitManager.createBranch(branchName, undefined, safeRoot);
    } catch (err) {
      this.logger.warn(`Could not create isolated branch ${branchName}, falling back to current branch:`, err);
      isIsolatedBranch = false;
    }

    const info: WorkspaceInfo = {
      workspaceId,
      workerId,
      taskId,
      branchName,
      workspacePath: safeRoot,
      isIsolatedBranch,
      createdAt: new Date().toISOString(),
    };

    this.workspaces.set(workspaceId, info);
    return info;
  }

  getWorkspace(workspaceId: string): WorkspaceInfo | null {
    return this.workspaces.get(workspaceId) ?? null;
  }

  getWorkspaceForTask(taskId: string): WorkspaceInfo | null {
    for (const ws of this.workspaces.values()) {
      if (ws.taskId === taskId) return ws;
    }
    return null;
  }

  getAllWorkspaces(): WorkspaceInfo[] {
    return Array.from(this.workspaces.values());
  }
}

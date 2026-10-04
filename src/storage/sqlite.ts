/**
 * SQLite Operational State Store for Vibe Engineering MCP
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { Project, ProjectSchema } from '../models/project.js';
import { Task, TaskSchema, TaskState } from '../models/task.js';
import { Module, ModuleSchema } from '../models/module.js';
import { Contract, ContractSchema, ObservableEvidence, ObservableEvidenceSchema } from '../models/contract.js';
import { Checkpoint, CheckpointSchema } from '../models/checkpoint.js';
import { Worker, WorkerSchema } from '../models/worker.js';
import { Logger } from '../utils/logger.js';

export interface CommandLog {
  id: string;
  projectId: string;
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  timestamp: string;
}

export class SQLiteStateStore {
  private db: DatabaseSync;
  private logger = new Logger('SQLiteStateStore');

  constructor(dbPath: string = ':memory:') {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(dbPath);
    this.initializeSchema();
  }

  private initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        root_path TEXT NOT NULL,
        status TEXT NOT NULL,
        current_phase TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        state TEXT NOT NULL,
        priority TEXT NOT NULL,
        dependencies_json TEXT NOT NULL,
        assigned_worker_id TEXT,
        claimed_at TEXT,
        module_id TEXT,
        contract_spec_json TEXT,
        is_repair_task INTEGER NOT NULL DEFAULT 0,
        original_failing_task_id TEXT,
        repair_context_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS modules (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        version TEXT NOT NULL,
        entrypoint TEXT NOT NULL,
        observable_type TEXT NOT NULL,
        harness_command TEXT NOT NULL,
        interface_contract_id TEXT,
        dependencies_json TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contracts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        module_id TEXT,
        input_description TEXT NOT NULL,
        expected_behavior TEXT NOT NULL,
        rules_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS evidence (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        module_id TEXT,
        command TEXT NOT NULL,
        exit_code INTEGER NOT NULL,
        stdout TEXT NOT NULL,
        stderr TEXT NOT NULL,
        execution_time_ms INTEGER NOT NULL,
        evidence_type TEXT NOT NULL,
        captured_artifacts_json TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS checkpoints (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        git_commit_sha TEXT NOT NULL,
        phase TEXT NOT NULL,
        summary TEXT NOT NULL,
        verified_capabilities_json TEXT NOT NULL,
        active_tasks_json TEXT NOT NULL,
        ready_tasks_json TEXT NOT NULL,
        blocked_tasks_json TEXT NOT NULL,
        worker_assignments_json TEXT NOT NULL,
        workspace_info_json TEXT NOT NULL,
        latest_observations_json TEXT NOT NULL,
        failures_json TEXT NOT NULL,
        architecture_decisions_json TEXT NOT NULL,
        interface_versions_json TEXT NOT NULL,
        integration_status TEXT NOT NULL,
        next_recommended_action TEXT NOT NULL,
        runtime_commands_json TEXT NOT NULL,
        files_touched_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS command_logs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        command TEXT NOT NULL,
        cwd TEXT NOT NULL,
        exit_code INTEGER NOT NULL,
        stdout TEXT NOT NULL,
        stderr TEXT NOT NULL,
        execution_time_ms INTEGER NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workers (
        id TEXT PRIMARY KEY,
        model_name TEXT NOT NULL,
        provider TEXT NOT NULL,
        status TEXT NOT NULL,
        assigned_task_id TEXT,
        workspace_path TEXT,
        last_active_at TEXT NOT NULL
      );
    `);
    this.logger.debug('SQLite schema initialized');
  }

  // --- PROJECTS ---
  saveProject(project: Project): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO projects (
        id, name, description, root_path, status, current_phase, created_at, updated_at, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      project.id,
      project.name,
      project.description,
      project.rootPath,
      project.status,
      project.currentPhase,
      project.createdAt,
      project.updatedAt,
      JSON.stringify(project.metadata || {})
    );
  }

  getProject(id: string): Project | null {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return ProjectSchema.parse({
      id: row.id,
      name: row.name,
      description: row.description,
      rootPath: row.root_path,
      status: row.status,
      currentPhase: row.current_phase,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: JSON.parse((row.metadata_json as string) || '{}'),
    });
  }

  getAllProjects(): Project[] {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
    const rows = stmt.all() as Array<Record<string, unknown>>;
    return rows.map((row) =>
      ProjectSchema.parse({
        id: row.id,
        name: row.name,
        description: row.description,
        rootPath: row.root_path,
        status: row.status,
        currentPhase: row.current_phase,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        metadata: JSON.parse((row.metadata_json as string) || '{}'),
      })
    );
  }

  // --- TASKS ---
  saveTask(task: Task): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tasks (
        id, project_id, title, description, state, priority, dependencies_json,
        assigned_worker_id, claimed_at, module_id, contract_spec_json,
        is_repair_task, original_failing_task_id, repair_context_json,
        created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.id,
      task.projectId,
      task.title,
      task.description,
      task.state,
      task.priority,
      JSON.stringify(task.dependencies),
      task.assignedWorkerId,
      task.claimedAt,
      task.moduleId,
      task.contractSpec ? JSON.stringify(task.contractSpec) : null,
      task.isRepairTask ? 1 : 0,
      task.originalFailingTaskId,
      task.repairContext ? JSON.stringify(task.repairContext) : null,
      task.createdAt,
      task.updatedAt,
      task.completedAt
    );
  }

  getTask(id: string): Task | null {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return TaskSchema.parse({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      state: row.state,
      priority: row.priority,
      dependencies: JSON.parse((row.dependencies_json as string) || '[]'),
      assignedWorkerId: row.assigned_worker_id ?? null,
      claimedAt: row.claimed_at ?? null,
      moduleId: row.module_id ?? null,
      contractSpec: row.contract_spec_json ? JSON.parse(row.contract_spec_json as string) : undefined,
      isRepairTask: Boolean(row.is_repair_task),
      originalFailingTaskId: row.original_failing_task_id ?? null,
      repairContext: row.repair_context_json ? JSON.parse(row.repair_context_json as string) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at ?? null,
    });
  }

  getTasksByProject(projectId: string): Task[] {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at ASC');
    const rows = stmt.all(projectId) as Array<Record<string, unknown>>;
    return rows.map((row) =>
      TaskSchema.parse({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        description: row.description,
        state: row.state,
        priority: row.priority,
        dependencies: JSON.parse((row.dependencies_json as string) || '[]'),
        assignedWorkerId: row.assigned_worker_id ?? null,
        claimedAt: row.claimed_at ?? null,
        moduleId: row.module_id ?? null,
        contractSpec: row.contract_spec_json ? JSON.parse(row.contract_spec_json as string) : undefined,
        isRepairTask: Boolean(row.is_repair_task),
        originalFailingTaskId: row.original_failing_task_id ?? null,
        repairContext: row.repair_context_json ? JSON.parse(row.repair_context_json as string) : undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at ?? null,
      })
    );
  }

  // --- MODULES ---
  saveModule(mod: Module): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO modules (
        id, project_id, name, description, version, entrypoint, observable_type,
        harness_command, interface_contract_id, dependencies_json, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      mod.id,
      mod.projectId,
      mod.name,
      mod.description,
      mod.version,
      mod.entrypoint,
      mod.observableType,
      mod.harnessCommand,
      mod.interfaceContractId,
      JSON.stringify(mod.dependencies),
      mod.status,
      mod.createdAt,
      mod.updatedAt
    );
  }

  getModule(id: string): Module | null {
    const stmt = this.db.prepare('SELECT * FROM modules WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return ModuleSchema.parse({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      version: row.version,
      entrypoint: row.entrypoint,
      observableType: row.observable_type,
      harnessCommand: row.harness_command,
      interfaceContractId: row.interface_contract_id ?? null,
      dependencies: JSON.parse((row.dependencies_json as string) || '[]'),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  getModulesByProject(projectId: string): Module[] {
    const stmt = this.db.prepare('SELECT * FROM modules WHERE project_id = ?');
    const rows = stmt.all(projectId) as Array<Record<string, unknown>>;
    return rows.map((row) =>
      ModuleSchema.parse({
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        description: row.description,
        version: row.version,
        entrypoint: row.entrypoint,
        observableType: row.observable_type,
        harnessCommand: row.harness_command,
        interfaceContractId: row.interface_contract_id ?? null,
        dependencies: JSON.parse((row.dependencies_json as string) || '[]'),
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })
    );
  }

  // --- CONTRACTS ---
  saveContract(contract: Contract): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO contracts (
        id, project_id, name, description, module_id, input_description, expected_behavior, rules_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      contract.id,
      contract.projectId,
      contract.name,
      contract.description,
      contract.moduleId,
      contract.inputDescription,
      contract.expectedBehavior,
      JSON.stringify(contract.rules),
      contract.createdAt,
      contract.updatedAt
    );
  }

  getContract(id: string): Contract | null {
    const stmt = this.db.prepare('SELECT * FROM contracts WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return ContractSchema.parse({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      moduleId: row.module_id ?? null,
      inputDescription: row.input_description,
      expectedBehavior: row.expected_behavior,
      rules: JSON.parse((row.rules_json as string) || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  getContractsByProject(projectId: string): Contract[] {
    const stmt = this.db.prepare('SELECT * FROM contracts WHERE project_id = ?');
    const rows = stmt.all(projectId) as Array<Record<string, unknown>>;
    return rows.map((row) =>
      ContractSchema.parse({
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        description: row.description,
        moduleId: row.module_id ?? null,
        inputDescription: row.input_description,
        expectedBehavior: row.expected_behavior,
        rules: JSON.parse((row.rules_json as string) || '[]'),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })
    );
  }

  // --- EVIDENCE ---
  saveEvidence(evidence: ObservableEvidence): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO evidence (
        id, task_id, module_id, command, exit_code, stdout, stderr,
        execution_time_ms, evidence_type, captured_artifacts_json, captured_at, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      evidence.id,
      evidence.taskId ?? null,
      evidence.moduleId ?? null,
      evidence.command,
      evidence.exitCode,
      evidence.stdout,
      evidence.stderr,
      evidence.executionTimeMs,
      evidence.evidenceType,
      JSON.stringify(evidence.capturedArtifacts || []),
      evidence.capturedAt,
      JSON.stringify(evidence.metadata || {})
    );
  }

  getEvidenceByTask(taskId: string): ObservableEvidence[] {
    const stmt = this.db.prepare('SELECT * FROM evidence WHERE task_id = ? ORDER BY captured_at DESC');
    const rows = stmt.all(taskId) as Array<Record<string, unknown>>;
    return rows.map((row) =>
      ObservableEvidenceSchema.parse({
        id: row.id,
        taskId: row.task_id ?? undefined,
        moduleId: row.module_id ?? undefined,
        command: row.command,
        exitCode: row.exit_code,
        stdout: row.stdout,
        stderr: row.stderr,
        executionTimeMs: row.execution_time_ms,
        evidenceType: row.evidence_type,
        capturedArtifacts: JSON.parse((row.captured_artifacts_json as string) || '[]'),
        capturedAt: row.captured_at,
        metadata: JSON.parse((row.metadata_json as string) || '{}'),
      })
    );
  }

  getEvidence(id: string): ObservableEvidence | null {
    const stmt = this.db.prepare('SELECT * FROM evidence WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return ObservableEvidenceSchema.parse({
      id: row.id,
      taskId: row.task_id ?? undefined,
      moduleId: row.module_id ?? undefined,
      command: row.command,
      exitCode: row.exit_code,
      stdout: row.stdout,
      stderr: row.stderr,
      executionTimeMs: row.execution_time_ms,
      evidenceType: row.evidence_type,
      capturedArtifacts: JSON.parse((row.captured_artifacts_json as string) || '[]'),
      capturedAt: row.captured_at,
      metadata: JSON.parse((row.metadata_json as string) || '{}'),
    });
  }

  // --- CHECKPOINTS ---
  saveCheckpoint(checkpoint: Checkpoint): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO checkpoints (
        id, project_id, git_commit_sha, phase, summary, verified_capabilities_json,
        active_tasks_json, ready_tasks_json, blocked_tasks_json, worker_assignments_json,
        workspace_info_json, latest_observations_json, failures_json, architecture_decisions_json,
        interface_versions_json, integration_status, next_recommended_action,
        runtime_commands_json, files_touched_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      checkpoint.id,
      checkpoint.projectId,
      checkpoint.gitCommitSha,
      checkpoint.phase,
      checkpoint.summary,
      JSON.stringify(checkpoint.verifiedCapabilities),
      JSON.stringify(checkpoint.activeTasks),
      JSON.stringify(checkpoint.readyTasks),
      JSON.stringify(checkpoint.blockedTasks),
      JSON.stringify(checkpoint.workerAssignments),
      JSON.stringify(checkpoint.workspaceInfo),
      JSON.stringify(checkpoint.latestObservations),
      JSON.stringify(checkpoint.failures),
      JSON.stringify(checkpoint.architectureDecisions),
      JSON.stringify(checkpoint.interfaceVersions),
      checkpoint.integrationStatus,
      checkpoint.nextRecommendedAction,
      JSON.stringify(checkpoint.runtimeCommands),
      JSON.stringify(checkpoint.filesTouched),
      checkpoint.createdAt
    );
  }

  getLatestCheckpoint(projectId: string): Checkpoint | null {
    const stmt = this.db.prepare('SELECT * FROM checkpoints WHERE project_id = ? ORDER BY created_at DESC LIMIT 1');
    const row = stmt.get(projectId) as Record<string, unknown> | undefined;
    if (!row) return null;

    return CheckpointSchema.parse({
      id: row.id,
      projectId: row.project_id,
      gitCommitSha: row.git_commit_sha,
      phase: row.phase,
      summary: row.summary,
      verifiedCapabilities: JSON.parse((row.verified_capabilities_json as string) || '[]'),
      activeTasks: JSON.parse((row.active_tasks_json as string) || '[]'),
      readyTasks: JSON.parse((row.ready_tasks_json as string) || '[]'),
      blockedTasks: JSON.parse((row.blocked_tasks_json as string) || '[]'),
      workerAssignments: JSON.parse((row.worker_assignments_json as string) || '{}'),
      workspaceInfo: JSON.parse((row.workspace_info_json as string) || '{}'),
      latestObservations: JSON.parse((row.latest_observations_json as string) || '[]'),
      failures: JSON.parse((row.failures_json as string) || '[]'),
      architectureDecisions: JSON.parse((row.architecture_decisions_json as string) || '[]'),
      interfaceVersions: JSON.parse((row.interface_versions_json as string) || '{}'),
      integrationStatus: row.integration_status,
      nextRecommendedAction: row.next_recommended_action,
      runtimeCommands: JSON.parse((row.runtime_commands_json as string) || '[]'),
      filesTouched: JSON.parse((row.files_touched_json as string) || '[]'),
      createdAt: row.created_at,
    });
  }

  getCheckpoint(id: string): Checkpoint | null {
    const stmt = this.db.prepare('SELECT * FROM checkpoints WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return CheckpointSchema.parse({
      id: row.id,
      projectId: row.project_id,
      gitCommitSha: row.git_commit_sha,
      phase: row.phase,
      summary: row.summary,
      verifiedCapabilities: JSON.parse((row.verified_capabilities_json as string) || '[]'),
      activeTasks: JSON.parse((row.active_tasks_json as string) || '[]'),
      readyTasks: JSON.parse((row.ready_tasks_json as string) || '[]'),
      blockedTasks: JSON.parse((row.blocked_tasks_json as string) || '[]'),
      workerAssignments: JSON.parse((row.worker_assignments_json as string) || '{}'),
      workspaceInfo: JSON.parse((row.workspace_info_json as string) || '{}'),
      latestObservations: JSON.parse((row.latest_observations_json as string) || '[]'),
      failures: JSON.parse((row.failures_json as string) || '[]'),
      architectureDecisions: JSON.parse((row.architecture_decisions_json as string) || '[]'),
      interfaceVersions: JSON.parse((row.interface_versions_json as string) || '{}'),
      integrationStatus: row.integration_status,
      nextRecommendedAction: row.next_recommended_action,
      runtimeCommands: JSON.parse((row.runtime_commands_json as string) || '[]'),
      filesTouched: JSON.parse((row.files_touched_json as string) || '[]'),
      createdAt: row.created_at,
    });
  }

  // --- COMMAND LOGS ---
  saveCommandLog(log: CommandLog): void {
    const stmt = this.db.prepare(`
      INSERT INTO command_logs (
        id, project_id, command, cwd, exit_code, stdout, stderr, execution_time_ms, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      log.id,
      log.projectId,
      log.command,
      log.cwd,
      log.exitCode,
      log.stdout,
      log.stderr,
      log.executionTimeMs,
      log.timestamp
    );
  }

  getRecentCommandLogs(projectId: string, limit: number = 20): CommandLog[] {
    const stmt = this.db.prepare('SELECT * FROM command_logs WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?');
    const rows = stmt.all(projectId, limit) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: row.id as string,
      projectId: row.project_id as string,
      command: row.command as string,
      cwd: row.cwd as string,
      exitCode: Number(row.exit_code),
      stdout: row.stdout as string,
      stderr: row.stderr as string,
      executionTimeMs: Number(row.execution_time_ms),
      timestamp: row.timestamp as string,
    }));
  }

  // --- WORKERS ---
  saveWorker(worker: Worker): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO workers (
        id, model_name, provider, status, assigned_task_id, workspace_path, last_active_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      worker.id,
      worker.modelName,
      worker.provider,
      worker.status,
      worker.assignedTaskId,
      worker.workspacePath,
      worker.lastActiveAt
    );
  }

  getWorker(id: string): Worker | null {
    const stmt = this.db.prepare('SELECT * FROM workers WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return WorkerSchema.parse({
      id: row.id,
      modelName: row.model_name,
      provider: row.provider,
      status: row.status,
      assignedTaskId: row.assigned_task_id ?? null,
      workspacePath: row.workspace_path ?? null,
      lastActiveAt: row.last_active_at,
    });
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Module Runner: executes a module runnable harness with input and captures observable evidence
 */
import { CommandRunner } from './command-runner.js';
import { ObservableEvidenceCollector } from './observer.js';
import { SQLiteStateStore } from '../storage/sqlite.js';
import { ObservableEvidence } from '../models/contract.js';
import { Module } from '../models/module.js';
import { Logger } from '../utils/logger.js';

export interface ModuleRunResult {
  success: boolean;
  module: Module;
  evidence: ObservableEvidence;
  error?: string;
}

export class ModuleRunner {
  private logger = new Logger('ModuleRunner');

  constructor(
    private commandRunner: CommandRunner,
    private observer: ObservableEvidenceCollector,
    private stateStore: SQLiteStateStore
  ) {}

  async run(
    moduleId: string,
    options: {
      inputArgs?: string;
      customHarness?: string;
      cwd?: string;
      taskId?: string;
    } = {}
  ): Promise<ModuleRunResult> {
    const mod = this.stateStore.getModule(moduleId);
    if (!mod) {
      throw new Error(`Module with ID '${moduleId}' not found in state store`);
    }

    const baseCommand = options.customHarness || mod.harnessCommand;
    const fullCommand = options.inputArgs ? `${baseCommand} ${options.inputArgs}` : baseCommand;

    this.logger.info(`Running module '${mod.name}' (${mod.id}) with harness: ${fullCommand}`);

    const cmdResult = await this.commandRunner.execute(fullCommand, {
      cwd: options.cwd,
      projectId: mod.projectId,
    });

    const evidence = this.observer.collect({
      taskId: options.taskId,
      moduleId: mod.id,
      command: fullCommand,
      exitCode: cmdResult.exitCode,
      stdout: cmdResult.stdout,
      stderr: cmdResult.stderr,
      executionTimeMs: cmdResult.executionTimeMs,
      evidenceType: mod.observableType,
    });

    const success = cmdResult.exitCode === 0;

    return {
      success,
      module: mod,
      evidence,
      error: success ? undefined : cmdResult.stderr || `Exited with code ${cmdResult.exitCode}`,
    };
  }
}

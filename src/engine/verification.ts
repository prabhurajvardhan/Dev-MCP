/**
 * Verification Engine: Implements the Task Completion Gate
 */
import { Task } from '../models/task.js';
import { SQLiteStateStore } from '../storage/sqlite.js';
import { GitManager } from '../execution/git-manager.js';
import { CommandRunner } from '../execution/command-runner.js';
import { ObservableEvidenceCollector } from '../execution/observer.js';
import { ContractEngine } from './contracts.js';
import { ObservableEvidence, VerificationResult } from '../models/contract.js';
import { generateTimestamp } from '../utils/id-gen.js';
import { Logger } from '../utils/logger.js';

export interface GateVerificationOutcome {
  passed: boolean;
  changedFiles: string[];
  gitDiff: string;
  testPassed: boolean;
  testOutput?: string;
  harnessPassed: boolean;
  contractPassed: boolean;
  evidence?: ObservableEvidence;
  failures: string[];
  failingCommand?: string;
  suggestedAction?: string;
}

export class VerificationEngine {
  private logger = new Logger('VerificationEngine');
  private contractEngine = new ContractEngine();

  constructor(
    private stateStore: SQLiteStateStore,
    private gitManager: GitManager,
    private commandRunner: CommandRunner,
    private observer: ObservableEvidenceCollector
  ) {}

  async runCompletionGate(
    task: Task,
    options: {
      cwd?: string;
      customTestCommand?: string;
    } = {}
  ): Promise<GateVerificationOutcome> {
    const failures: string[] = [];
    let failingCommand: string | undefined;
    let suggestedAction: string | undefined;

    // 1. Inspect changed files & git status
    const status = await this.gitManager.status(options.cwd);
    const diff = await this.gitManager.diff({ cwd: options.cwd });
    const changedFiles = Array.from(new Set([
      ...status.modifiedFiles,
      ...status.untrackedFiles,
      ...diff.filesChanged,
    ]));

    this.logger.info(`Completion gate for task ${task.id}: ${changedFiles.length} files changed`);

    // 2. Run test command if specified
    let testPassed = true;
    let testOutput: string | undefined;
    const testCmd = options.customTestCommand;
    if (testCmd) {
      this.logger.info(`Running gate test command: ${testCmd}`);
      const testRes = await this.commandRunner.execute(testCmd, {
        cwd: options.cwd,
        projectId: task.projectId,
      });
      testOutput = testRes.stdout + (testRes.stderr ? `\nSTDERR:\n${testRes.stderr}` : '');
      if (testRes.exitCode !== 0) {
        testPassed = false;
        failures.push(`Verification test command failed with code ${testRes.exitCode}`);
        failingCommand = testCmd;
        suggestedAction = 'Inspect test failures and correct implementation before completing';
      }
    }

    // 3. Run module's observable harness if task has contractSpec or linked module
    let harnessPassed = true;
    let contractPassed = true;
    let evidence: ObservableEvidence | undefined;

    const contractSpec = task.contractSpec;
    if (contractSpec && contractSpec.harnessCommand) {
      this.logger.info(`Executing observable harness: ${contractSpec.harnessCommand}`);
      const harnessRes = await this.commandRunner.execute(contractSpec.harnessCommand, {
        cwd: options.cwd,
        timeoutMs: contractSpec.timeoutMs || 20000,
        projectId: task.projectId,
      });

      evidence = this.observer.collect({
        taskId: task.id,
        moduleId: task.moduleId || undefined,
        command: contractSpec.harnessCommand,
        exitCode: harnessRes.exitCode,
        stdout: harnessRes.stdout,
        stderr: harnessRes.stderr,
        executionTimeMs: harnessRes.executionTimeMs,
        evidenceType: contractSpec.evidenceType || 'CLI',
      });

      // Verify exit code
      if (harnessRes.exitCode !== contractSpec.expectedExitCode) {
        harnessPassed = false;
        failures.push(
          `Observable harness exited with ${harnessRes.exitCode}, expected ${contractSpec.expectedExitCode}`
        );
        failingCommand = contractSpec.harnessCommand;
        suggestedAction = `Fix runtime error in harness command '${contractSpec.harnessCommand}'`;
      }

      // Verify stdout pattern if required
      if (contractSpec.stdoutPattern) {
        const regex = new RegExp(contractSpec.stdoutPattern);
        if (!regex.test(harnessRes.stdout)) {
          contractPassed = false;
          failures.push(`Harness output did not match pattern '${contractSpec.stdoutPattern}'`);
          failingCommand = contractSpec.harnessCommand;
          suggestedAction = `Ensure harness outputs expected pattern '${contractSpec.stdoutPattern}'`;
        }
      }

      // Verify json schema check if required
      if (contractSpec.jsonSchemaCheck) {
        try {
          const parsed = JSON.parse(harnessRes.stdout);
          for (const [key, val] of Object.entries(contractSpec.jsonSchemaCheck)) {
            if (!(key in parsed)) {
              contractPassed = false;
              failures.push(`JSON output missing expected field '${key}'`);
            } else if (val !== undefined && parsed[key] !== val && typeof val !== 'object') {
              contractPassed = false;
              failures.push(`JSON output '${key}' expected '${val}', got '${parsed[key]}'`);
            }
          }
        } catch (e) {
          contractPassed = false;
          failures.push(`Harness stdout is not valid JSON: ${(e as Error).message}`);
        }
      }
    }

    // 4. Also check explicit contract if module is linked
    if (task.moduleId) {
      const contracts = this.stateStore.getContractsByProject(task.projectId);
      const modContract = contracts.find((c) => c.moduleId === task.moduleId);
      if (modContract && evidence) {
        const verification = this.contractEngine.verifyEvidenceAgainstContract(modContract, evidence);
        if (!verification.passed) {
          contractPassed = false;
          failures.push(...verification.failures);
          if (!suggestedAction) {
            suggestedAction = `Satisfy contract rules for ${modContract.name}`;
          }
        }
      }
    }

    const passed = failures.length === 0;

    return {
      passed,
      changedFiles,
      gitDiff: diff.diff,
      testPassed,
      testOutput,
      harnessPassed,
      contractPassed,
      evidence,
      failures,
      failingCommand,
      suggestedAction,
    };
  }
}

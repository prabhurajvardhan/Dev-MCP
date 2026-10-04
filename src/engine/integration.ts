/**
 * Integration Manager: verifies cross-module integration contracts and system-wide flows
 */
import { CommandRunner } from '../execution/command-runner.js';
import { ObservableEvidenceCollector } from '../execution/observer.js';
import { SQLiteStateStore } from '../storage/sqlite.js';
import { ObservableEvidence } from '../models/contract.js';
import { generateId, generateTimestamp } from '../utils/id-gen.js';
import { Logger } from '../utils/logger.js';

export interface IntegrationTestSpec {
  name: string;
  description: string;
  modulesInvolved: string[];
  integrationCommand: string;
  expectedPattern?: string;
  timeoutMs?: number;
}

export interface IntegrationVerificationResult {
  passed: boolean;
  testName: string;
  evidence: ObservableEvidence;
  error?: string;
  timestamp: string;
}

export class IntegrationManager {
  private logger = new Logger('IntegrationManager');

  constructor(
    private stateStore: SQLiteStateStore,
    private commandRunner: CommandRunner,
    private observer: ObservableEvidenceCollector
  ) {}

  async verifyIntegration(
    projectId: string,
    spec: IntegrationTestSpec,
    cwd?: string
  ): Promise<IntegrationVerificationResult> {
    this.logger.info(`Running integration verification: ${spec.name}`);

    const cmdResult = await this.commandRunner.execute(spec.integrationCommand, {
      cwd,
      timeoutMs: spec.timeoutMs || 30000,
      projectId,
    });

    const evidence = this.observer.collect({
      command: spec.integrationCommand,
      exitCode: cmdResult.exitCode,
      stdout: cmdResult.stdout,
      stderr: cmdResult.stderr,
      executionTimeMs: cmdResult.executionTimeMs,
      metadata: { modulesInvolved: spec.modulesInvolved },
    });

    let passed = cmdResult.exitCode === 0;
    let error: string | undefined;

    if (!passed) {
      error = `Integration command failed with exit code ${cmdResult.exitCode}: ${cmdResult.stderr || cmdResult.stdout}`;
    } else if (spec.expectedPattern) {
      const regex = new RegExp(spec.expectedPattern);
      if (!regex.test(cmdResult.stdout)) {
        passed = false;
        error = `Integration output did not match expected pattern: ${spec.expectedPattern}`;
      }
    }

    return {
      passed,
      testName: spec.name,
      evidence,
      error,
      timestamp: generateTimestamp(),
    };
  }
}

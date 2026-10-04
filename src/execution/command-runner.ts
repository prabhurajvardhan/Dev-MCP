/**
 * Command Runner with execution scoping, timeout, logging, and security evaluation
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { CommandPolicy } from '../security/command-policy.js';
import { PathPolicy } from '../security/path-policy.js';
import { SQLiteStateStore, CommandLog } from '../storage/sqlite.js';
import { generateId, generateTimestamp } from '../utils/id-gen.js';
import { Logger } from '../utils/logger.js';

export interface CommandRunResult {
  commandId: string;
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  timestamp: string;
}

export class CommandRunner {
  private logger = new Logger('CommandRunner');
  private pathPolicy: PathPolicy;

  constructor(
    private projectRoot: string,
    private stateStore?: SQLiteStateStore
  ) {
    this.pathPolicy = new PathPolicy(projectRoot);
  }

  async execute(
    command: string,
    options: {
      cwd?: string;
      timeoutMs?: number;
      projectId?: string;
      env?: Record<string, string>;
    } = {}
  ): Promise<CommandRunResult> {
    const { cwd = this.projectRoot, timeoutMs = 30000, projectId = 'default', env = {} } = options;

    // Security check on path
    const safeCwd = this.pathPolicy.resolveSafePath(cwd);

    // Security check on command
    const evaluation = CommandPolicy.evaluate(command);
    if (!evaluation.allowed) {
      throw new Error(`Command blocked by security policy: ${evaluation.reason}`);
    }

    const commandId = generateId('cmd');
    const startTime = Date.now();
    const timestamp = generateTimestamp();

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(command, {
        cwd: safeCwd,
        shell: true,
        env: {
          ...process.env,
          ...env,
          NODE_ENV: 'test',
        },
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        stderr += `\n[Vibe CommandRunner] Execution timed out after ${timeoutMs}ms`;
      }, timeoutMs);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const executionTimeMs = Date.now() - startTime;
        const exitCode = timedOut ? -1 : (code ?? 0);

        const result: CommandRunResult = {
          commandId,
          command,
          cwd: safeCwd,
          exitCode,
          stdout,
          stderr,
          executionTimeMs,
          timestamp,
        };

        if (this.stateStore && projectId) {
          const log: CommandLog = {
            id: commandId,
            projectId,
            command,
            cwd: safeCwd,
            exitCode,
            stdout,
            stderr,
            executionTimeMs,
            timestamp,
          };
          try {
            this.stateStore.saveCommandLog(log);
          } catch (err) {
            this.logger.warn('Failed to record command log to sqlite', err);
          }
        }

        resolve(result);
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        const executionTimeMs = Date.now() - startTime;
        const result: CommandRunResult = {
          commandId,
          command,
          cwd: safeCwd,
          exitCode: -1,
          stdout,
          stderr: `${stderr}\n${err.message}`,
          executionTimeMs,
          timestamp,
        };
        resolve(result);
      });
    });
  }
}

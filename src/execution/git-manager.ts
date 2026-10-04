/**
 * Git Manager: executes git commands within the project repository
 */
import { CommandRunner } from './command-runner.js';
import { Logger } from '../utils/logger.js';

export interface GitStatusResult {
  branch: string;
  isClean: boolean;
  stagedFiles: string[];
  modifiedFiles: string[];
  untrackedFiles: string[];
  raw: string;
}

export interface GitDiffResult {
  diff: string;
  filesChanged: string[];
  insertions: number;
  deletions: number;
}

export class GitManager {
  private logger = new Logger('GitManager');

  constructor(
    private projectRoot: string,
    private commandRunner: CommandRunner
  ) {}

  async getCurrentCommitSha(cwd?: string): Promise<string> {
    const res = await this.commandRunner.execute('git rev-parse HEAD', { cwd });
    if (res.exitCode !== 0) {
      return '0000000000000000000000000000000000000000';
    }
    return res.stdout.trim();
  }

  async getCurrentBranch(cwd?: string): Promise<string> {
    const res = await this.commandRunner.execute('git rev-parse --abbrev-ref HEAD', { cwd });
    if (res.exitCode !== 0) {
      return 'main';
    }
    return res.stdout.trim();
  }

  async status(cwd?: string): Promise<GitStatusResult> {
    const branch = await this.getCurrentBranch(cwd);
    const res = await this.commandRunner.execute('git status --porcelain', { cwd });
    const raw = res.stdout;
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);

    const stagedFiles: string[] = [];
    const modifiedFiles: string[] = [];
    const untrackedFiles: string[] = [];

    for (const line of lines) {
      const code = line.slice(0, 2);
      const file = line.slice(3).trim();
      if (code === '??') {
        untrackedFiles.push(file);
      } else if (code[0] !== ' ' && code[0] !== '?') {
        stagedFiles.push(file);
      }
      if (code[1] !== ' ' && code[1] !== '?') {
        modifiedFiles.push(file);
      }
    }

    const isClean = lines.length === 0;
    return {
      branch,
      isClean,
      stagedFiles,
      modifiedFiles,
      untrackedFiles,
      raw: res.stdout,
    };
  }

  async diff(options: { staged?: boolean; file?: string; cwd?: string } = {}): Promise<GitDiffResult> {
    const { staged = false, file, cwd } = options;
    let cmd = 'git diff';
    if (staged) cmd += ' --cached';
    if (file) cmd += ` -- "${file}"`;

    const res = await this.commandRunner.execute(cmd, { cwd });
    const statRes = await this.commandRunner.execute(`${cmd} --stat`, { cwd });

    const filesChanged: string[] = [];
    const statLines = statRes.stdout.split('\n');
    let insertions = 0;
    let deletions = 0;

    for (const line of statLines) {
      if (line.includes('|')) {
        const f = line.split('|')[0].trim();
        if (f) filesChanged.push(f);
      }
      const match = line.match(/(\d+)\s+insertion.*(\d+)\s+deletion/);
      if (match) {
        insertions = parseInt(match[1], 10);
        deletions = parseInt(match[2], 10);
      }
    }

    return {
      diff: res.stdout,
      filesChanged,
      insertions,
      deletions,
    };
  }

  async commit(
    message: string,
    files?: string[],
    cwd?: string,
    allowEmpty: boolean = true
  ): Promise<{ commitSha: string; summary: string }> {
    if (files && files.length > 0) {
      const escaped = files.map((f) => `"${f}"`).join(' ');
      await this.commandRunner.execute(`git add ${escaped}`, { cwd });
    } else {
      await this.commandRunner.execute('git add -A', { cwd });
    }

    const safeMessage = message.replace(/"/g, '\\"');
    const emptyFlag = allowEmpty ? ' --allow-empty' : '';
    const res = await this.commandRunner.execute(`git commit -m "${safeMessage}"${emptyFlag}`, { cwd });
    if (res.exitCode !== 0) {
      throw new Error(`Git commit failed: ${res.stderr || res.stdout}`);
    }

    const commitSha = await this.getCurrentCommitSha(cwd);
    return {
      commitSha,
      summary: res.stdout.trim(),
    };
  }

  async createBranch(branchName: string, startPoint?: string, cwd?: string): Promise<string> {
    const cmd = startPoint ? `git checkout -b "${branchName}" "${startPoint}"` : `git checkout -b "${branchName}"`;
    const res = await this.commandRunner.execute(cmd, { cwd });
    if (res.exitCode !== 0) {
      throw new Error(`Git create branch failed: ${res.stderr || res.stdout}`);
    }
    return branchName;
  }

  async merge(branchName: string, cwd?: string): Promise<{ success: boolean; output: string }> {
    const res = await this.commandRunner.execute(`git merge --no-ff "${branchName}"`, { cwd });
    return {
      success: res.exitCode === 0,
      output: res.stdout + res.stderr,
    };
  }
}

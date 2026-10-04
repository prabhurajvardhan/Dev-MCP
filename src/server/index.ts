#!/usr/bin/env node
/**
 * Vibe Engineering MCP Server
 * Entry point for the agentic software-engineering control plane.
 */
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio, StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import path from 'node:path';
import { SQLiteStateStore } from '../storage/sqlite.js';
import { VibeFileStore } from '../storage/vibe-file-store.js';
import { PathPolicy } from '../security/path-policy.js';
import { CommandRunner } from '../execution/command-runner.js';
import { GitManager } from '../execution/git-manager.js';
import { WorkspaceManager } from '../execution/workspace-manager.js';
import { ObservableEvidenceCollector } from '../execution/observer.js';
import { ModuleRunner } from '../execution/module-runner.js';
import { TaskScheduler } from '../engine/scheduler.js';
import { ContractEngine } from '../engine/contracts.js';
import { VerificationEngine } from '../engine/verification.js';
import { TaskEngine } from '../engine/task-engine.js';
import { CheckpointManager } from '../engine/checkpoint.js';
import { IntegrationManager } from '../engine/integration.js';
import { ProjectEngine } from '../engine/project-engine.js';
import { registerProjectTools } from './tools/project-tools.js';
import { registerTaskTools } from './tools/task-tools.js';
import { registerWorkspaceTools } from './tools/workspace-tools.js';
import { registerRepoTools } from './tools/repo-tools.js';
import { registerTerminalTools } from './tools/terminal-tools.js';
import { registerGitTools } from './tools/git-tools.js';
import { registerModuleTools } from './tools/module-tools.js';
import { registerVerificationTools } from './tools/verification-tools.js';
import { registerCheckpointTools } from './tools/checkpoint-tools.js';
import { Logger } from '../utils/logger.js';

export interface VibeMcpContext {
  server: McpServer;
  stateStore: SQLiteStateStore;
  vibeFileStore: VibeFileStore;
  pathPolicy: PathPolicy;
  commandRunner: CommandRunner;
  gitManager: GitManager;
  workspaceManager: WorkspaceManager;
  observer: ObservableEvidenceCollector;
  moduleRunner: ModuleRunner;
  scheduler: TaskScheduler;
  contractEngine: ContractEngine;
  verificationEngine: VerificationEngine;
  taskEngine: TaskEngine;
  checkpointManager: CheckpointManager;
  projectEngine: ProjectEngine;
}

export function createVibeMcpServer(options: {
  projectRoot?: string;
  sqlitePath?: string;
} = {}): VibeMcpContext {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const sqlitePath = options.sqlitePath || path.join(projectRoot, '.vibe', 'vibe_state.sqlite');

  const logger = new Logger('VibeMcpServer');
  logger.info(`Initializing Vibe Engineering MCP for root: ${projectRoot}`);

  // Storage
  const stateStore = new SQLiteStateStore(sqlitePath);
  const vibeFileStore = new VibeFileStore(projectRoot);
  vibeFileStore.ensureDirectories();

  // Security & Execution
  const pathPolicy = new PathPolicy(projectRoot);
  const commandRunner = new CommandRunner(projectRoot, stateStore);
  const gitManager = new GitManager(projectRoot, commandRunner);
  const workspaceManager = new WorkspaceManager(projectRoot, gitManager, commandRunner);
  const observer = new ObservableEvidenceCollector(stateStore, vibeFileStore);
  const moduleRunner = new ModuleRunner(commandRunner, observer, stateStore);

  // Engine
  const scheduler = new TaskScheduler(stateStore);
  const contractEngine = new ContractEngine();
  const verificationEngine = new VerificationEngine(stateStore, gitManager, commandRunner, observer);
  const taskEngine = new TaskEngine(stateStore, verificationEngine, scheduler, vibeFileStore);
  const checkpointManager = new CheckpointManager(stateStore, gitManager, scheduler, vibeFileStore);
  const projectEngine = new ProjectEngine(stateStore, vibeFileStore, gitManager, checkpointManager, scheduler);

  // MCP Server
  const server = new McpServer({
    name: 'vibe-engineering-mcp',
    version: '0.1.0',
  });

  // Register all 9 tool groups
  registerProjectTools(server, projectEngine, checkpointManager);
  registerTaskTools(server, taskEngine, scheduler, stateStore);
  registerWorkspaceTools(server, workspaceManager);
  registerRepoTools(server, pathPolicy);
  registerTerminalTools(server, commandRunner);
  registerGitTools(server, gitManager);
  registerModuleTools(server, moduleRunner, observer);
  registerVerificationTools(server, contractEngine, new IntegrationManager(stateStore, commandRunner, observer), stateStore);
  registerCheckpointTools(server, checkpointManager);

  return {
    server,
    stateStore,
    vibeFileStore,
    pathPolicy,
    commandRunner,
    gitManager,
    workspaceManager,
    observer,
    moduleRunner,
    scheduler,
    contractEngine,
    verificationEngine,
    taskEngine,
    checkpointManager,
    projectEngine,
  };
}

// Start stdio transport if executed as CLI entry point
if (process.argv[1] && (process.argv[1].endsWith('server/index.ts') || process.argv[1].endsWith('server/index.js') || process.argv[1].endsWith('vibe-mcp'))) {
  const context = createVibeMcpServer();
  serveStdio(() => context.server, { legacy: 'serve' });
}

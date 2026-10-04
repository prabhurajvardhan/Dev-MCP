import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

describe('Real MCP Protocol over Stdio: End-to-End Engineering Control Plane', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', 'src/server/index.ts'],
    });

    client = new Client({ name: 'test-vibe-client', version: '1.0.0' });
    await client.connect(transport);
  }, 25000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  it('connects via MCP protocol and discovers all registered engineering tools', async () => {
    const response = await client.listTools();
    expect(response.tools).toBeDefined();
    expect(response.tools.length).toBeGreaterThanOrEqual(25);

    const toolNames = response.tools.map((t) => t.name);
    expect(toolNames).toContain('project_initialize');
    expect(toolNames).toContain('project_inspect');
    expect(toolNames).toContain('project_resume');
    expect(toolNames).toContain('task_create');
    expect(toolNames).toContain('task_next');
    expect(toolNames).toContain('task_claim');
    expect(toolNames).toContain('task_complete');
    expect(toolNames).toContain('workspace_create');
    expect(toolNames).toContain('workspace_status');
    expect(toolNames).toContain('repo_write_file');
    expect(toolNames).toContain('repo_read_file');
    expect(toolNames).toContain('terminal_exec');
    expect(toolNames).toContain('git_status');
    expect(toolNames).toContain('git_diff');
    expect(toolNames).toContain('git_commit');
    expect(toolNames).toContain('module_observe');
    expect(toolNames).toContain('contract_verify');
    expect(toolNames).toContain('checkpoint_create');
    expect(toolNames).toContain('checkpoint_load');
  });

  it('executes Section 19: Minimal deterministic scenario "Hello Observable App" producing HELLO_VIBE', async () => {
    // 1. Initialize project
    const initRes = await client.callTool({
      name: 'project_initialize',
      arguments: {
        name: 'Hello Observable App',
        description: 'Deterministic executable capability module that produces HELLO_VIBE',
        rootPath: process.cwd(),
      },
    });

    const initData = JSON.parse((initRes.content as any)[0].text);
    expect(initData.success).toBe(true);
    const projectId = initData.project.id;
    expect(projectId).toBeDefined();

    // 2. Create task with observable contract specification
    const createTaskRes = await client.callTool({
      name: 'task_create',
      arguments: {
        projectId,
        title: 'Implement HELLO_VIBE Observable Module',
        description: 'Create hello.js executable script that prints HELLO_VIBE and exits with code 0',
        priority: 'HIGH',
        contractSpec: {
          harnessCommand: 'node hello.js',
          expectedExitCode: 0,
          stdoutPattern: 'HELLO_VIBE',
          timeoutMs: 10000,
          evidenceType: 'CLI',
        },
      },
    });

    const taskData = JSON.parse((createTaskRes.content as any)[0].text);
    expect(taskData.success).toBe(true);
    const taskId = taskData.task.id;

    // 3. task.next identifies ready task
    const nextRes = await client.callTool({
      name: 'task_next',
      arguments: { projectId, workerId: 'worker-claude' },
    });
    const nextData = JSON.parse((nextRes.content as any)[0].text);
    expect(nextData.hasNextTask).toBe(true);
    expect(nextData.task.id).toBe(taskId);

    // 4. task.claim claims it
    const claimRes = await client.callTool({
      name: 'task_claim',
      arguments: { taskId, workerId: 'worker-claude' },
    });
    const claimData = JSON.parse((claimRes.content as any)[0].text);
    expect(claimData.success).toBe(true);
    expect(claimData.task.state).toBe('CLAIMED');

    // 5. workspace.create establishes isolated Git worktree
    const wsRes = await client.callTool({
      name: 'workspace_create',
      arguments: { workerId: 'worker-claude', taskId },
    });
    const wsData = JSON.parse((wsRes.content as any)[0].text);
    expect(wsData.success).toBe(true);
    expect(wsData.workspace.worktreePath).toBeDefined();
    expect(wsData.workspace.isIsolatedBranch).toBe(true);
    const worktreePath = wsData.workspace.worktreePath;

    // Verify worktree exists on filesystem
    expect(fs.existsSync(worktreePath)).toBe(true);

    // 6. repo_write_file creates hello.js inside isolated workspace
    const writeRes = await client.callTool({
      name: 'repo_write_file',
      arguments: {
        filePath: 'hello.js',
        content: `console.log("HELLO_VIBE");\nprocess.exit(0);\n`,
        workspaceRoot: worktreePath,
      },
    });
    const writeData = JSON.parse((writeRes.content as any)[0].text);
    expect(writeData.success).toBe(true);

    // Verify file exists inside worktree
    const helloFileInWorktree = path.join(worktreePath, 'hello.js');
    expect(fs.existsSync(helloFileInWorktree)).toBe(true);

    // 7. terminal_exec executes harness command in isolated workspace
    const execRes = await client.callTool({
      name: 'terminal_exec',
      arguments: {
        command: 'node hello.js',
        cwd: worktreePath,
      },
    });
    const execData = JSON.parse((execRes.content as any)[0].text);
    expect(execData.exitCode).toBe(0);
    expect(execData.stdout).toContain('HELLO_VIBE');

    // 8. module_observe captures evidence
    const obsRes = await client.callTool({
      name: 'module_observe',
      arguments: {
        command: 'node hello.js',
        exitCode: execData.exitCode,
        stdout: execData.stdout,
        stderr: execData.stderr,
        executionTimeMs: execData.executionTimeMs,
        taskId,
        artifactPaths: [helloFileInWorktree],
      },
    });
    const obsData = JSON.parse((obsRes.content as any)[0].text);
    expect(obsData.success).toBe(true);

    // 9. git_commit commits change in isolated workspace
    const commitRes = await client.callTool({
      name: 'git_commit',
      arguments: {
        message: 'feat: implement HELLO_VIBE observable capability',
        cwd: worktreePath,
      },
    });
    const commitData = JSON.parse((commitRes.content as any)[0].text);
    expect(commitData.success).toBe(true);
    expect(commitData.commitSha).toBeDefined();

    // 10. task_complete triggers Completion Gate
    const completeRes = await client.callTool({
      name: 'task_complete',
      arguments: {
        taskId,
        workerId: 'worker-claude',
        cwd: worktreePath,
      },
    });
    const completeData = JSON.parse((completeRes.content as any)[0].text);
    expect(completeData.success).toBe(true);
    expect(completeData.task.state).toBe('VERIFIED');
    expect(completeData.gateOutcome.passed).toBe(true);

    // 11. checkpoint_create records milestone state
    const chkRes = await client.callTool({
      name: 'checkpoint_create',
      arguments: {
        projectId,
        summary: 'HELLO_VIBE capability verified and frozen',
        cwd: worktreePath,
      },
    });
    const chkData = JSON.parse((chkRes.content as any)[0].text);
    expect(chkData.success).toBe(true);
    expect(chkData.checkpoint.id).toBeDefined();

    // 12. project_resume reconstructs full continuation briefing for a fresh worker model
    const resumeRes = await client.callTool({
      name: 'project_resume',
      arguments: { projectId },
    });
    const resumeData = JSON.parse((resumeRes.content as any)[0].text);
    expect(resumeData.projectId).toBe(projectId);
    expect(resumeData.completedCapabilities).toContain('[VERIFIED] Implement HELLO_VIBE Observable Module');
    expect(resumeData.instructionsForWorker).toContain('interchangeable intelligence worker');
  }, 35000);

  it('enforces Completion Gate rejection and automatic repair task generation over MCP', async () => {
    // Initialize test project
    const initRes = await client.callTool({
      name: 'project_initialize',
      arguments: {
        name: 'Failing Capability Project',
        description: 'Test project for completion gate failure rejection',
      },
    });
    const projectId = JSON.parse((initRes.content as any)[0].text).project.id;

    // Create a task with an unfulfillable contract
    const createTaskRes = await client.callTool({
      name: 'task_create',
      arguments: {
        projectId,
        title: 'Broken Task Destined to Fail',
        description: 'A task that will fail observable contract verification',
        contractSpec: {
          harnessCommand: 'node -e "process.exit(1)"',
          expectedExitCode: 0,
        },
      },
    });
    const taskId = JSON.parse((createTaskRes.content as any)[0].text).task.id;

    // Claim
    await client.callTool({
      name: 'task_claim',
      arguments: { taskId, workerId: 'worker-failing' },
    });

    // Attempt to complete without satisfying contract
    const completeRes = await client.callTool({
      name: 'task_complete',
      arguments: { taskId, workerId: 'worker-failing' },
    });
    const completeData = JSON.parse((completeRes.content as any)[0].text);

    // Completion Gate MUST reject this task!
    expect(completeData.success).toBe(false);
    expect(completeData.task.state).toBe('FAILED');
    expect(completeData.repairTask).toBeDefined();
    expect(completeData.repairTask.isRepairTask).toBe(true);
    expect(completeData.repairTask.originalFailingTaskId).toBe(taskId);
    expect(completeData.repairTask.state).toBe('READY');
  }, 25000);
});

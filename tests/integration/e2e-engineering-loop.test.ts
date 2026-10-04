import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createVibeMcpServer, VibeMcpContext } from '../../src/server/index.js';
import { Module } from '../../src/models/module.js';
import { Task } from '../../src/models/task.js';
import { Contract } from '../../src/models/contract.js';

describe('Vibe Engineering MCP: 19-Step End-to-End Engineering Loop', () => {
  let context: VibeMcpContext;
  const testDir = path.join(process.cwd(), '.vibe-test-e2e');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    context = createVibeMcpServer({
      projectRoot: process.cwd(),
      sqlitePath: ':memory:',
    });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('successfully executes the full 19-step autonomous engineering loop', async () => {
    const {
      projectEngine,
      scheduler,
      taskEngine,
      workspaceManager,
      pathPolicy,
      commandRunner,
      moduleRunner,
      observer,
      contractEngine,
      gitManager,
      checkpointManager,
      stateStore,
    } = context;

    // 1 & 2. project.initialize
    const project = await projectEngine.initializeProject(
      'Vibe Calculator Engine',
      'High integrity mathematical processing module with observable CLI harness',
      process.cwd(),
      'V0_FOUNDATION'
    );
    expect(project.id).toBeDefined();

    // 3. Define a simple module
    const moduleSpec: Module = {
      id: 'mod-core-math',
      projectId: project.id,
      name: 'CoreMath',
      description: 'Performs arithmetic operations and returns structured output',
      version: '0.1.0',
      entrypoint: '.vibe-test-e2e/calc.js',
      observableType: 'CLI',
      harnessCommand: 'node .vibe-test-e2e/calc.js 20 22',
      interfaceContractId: 'contract-math-sum',
      dependencies: [],
      status: 'BUILDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    stateStore.saveModule(moduleSpec);

    // Also define its contract
    const contractSpec: Contract = {
      id: 'contract-math-sum',
      projectId: project.id,
      name: 'Math Sum Contract',
      description: 'Contract for addition of two numbers',
      moduleId: 'mod-core-math',
      inputDescription: 'Two integer numbers as CLI arguments',
      expectedBehavior: 'Standard output must print SUM=42 and exit with 0',
      rules: [
        { type: 'EXIT_CODE', expected: 0 },
        { type: 'STDOUT_CONTAINS', expected: 'SUM=42' },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    stateStore.saveContract(contractSpec);

    // 4. Create a task
    const taskSpec: Task = {
      id: 'task-build-math',
      projectId: project.id,
      title: 'Implement CoreMath CLI Runner',
      description: 'Write calc.js to add numbers and print SUM=<result>',
      state: 'READY',
      priority: 'HIGH',
      dependencies: [],
      assignedWorkerId: null,
      claimedAt: null,
      moduleId: 'mod-core-math',
      contractSpec: {
        harnessCommand: 'node .vibe-test-e2e/calc.js 20 22',
        expectedExitCode: 0,
        stdoutPattern: 'SUM=42',
        timeoutMs: 10000,
        evidenceType: 'CLI',
      },
      isRepairTask: false,
      originalFailingTaskId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    };
    stateStore.saveTask(taskSpec);

    // 5. task.next returns the READY task
    const nextTask = scheduler.getNextTask(project.id, 'worker-claude');
    expect(nextTask).not.toBeNull();
    expect(nextTask?.id).toBe('task-build-math');

    // 6. task.claim claims it
    const claimedTask = taskEngine.claimTask(nextTask!.id, 'worker-claude');
    expect(claimedTask.state).toBe('CLAIMED');
    expect(claimedTask.assignedWorkerId).toBe('worker-claude');

    // 7. workspace.create creates an isolated workspace
    const workspace = await workspaceManager.createWorkspace('worker-claude', claimedTask.id);
    expect(workspace.workspaceId).toBeDefined();

    // 8. repo.write_file creates the implementation file
    const calcFilePath = path.join(testDir, 'calc.js');
    const calcCode = `
      const a = parseInt(process.argv[2] || '0', 10);
      const b = parseInt(process.argv[3] || '0', 10);
      console.log('Calculating...');
      console.log('SUM=' + (a + b));
      process.exit(0);
    `;
    fs.writeFileSync(calcFilePath, calcCode, 'utf8');
    expect(fs.existsSync(calcFilePath)).toBe(true);

    // 9. terminal.exec executes a safe command
    const execResult = await commandRunner.execute('node .vibe-test-e2e/calc.js 20 22');
    expect(execResult.exitCode).toBe(0);
    expect(execResult.stdout).toContain('SUM=42');

    // 10. module.run runs the module
    const runResult = await moduleRunner.run('mod-core-math');
    expect(runResult.success).toBe(true);
    expect(runResult.evidence.stdout).toContain('SUM=42');

    // 11. module.observe captures observable output
    const observed = observer.collect({
      taskId: claimedTask.id,
      moduleId: 'mod-core-math',
      command: 'node .vibe-test-e2e/calc.js 20 22',
      exitCode: runResult.evidence.exitCode,
      stdout: runResult.evidence.stdout,
      stderr: runResult.evidence.stderr,
      executionTimeMs: runResult.evidence.executionTimeMs,
      evidenceType: 'CLI',
      artifactPaths: [calcFilePath],
    });
    expect(observed.capturedArtifacts.length).toBe(1);

    // 12. contract.verify validates the output
    const verification = contractEngine.verifyEvidenceAgainstContract(contractSpec, observed);
    expect(verification.passed).toBe(true);

    // 13. git.status shows changes
    const gitStatus = await gitManager.status();
    expect(gitStatus).toBeDefined();
    expect(typeof gitStatus.branch).toBe('string');

    // 14. git.diff shows changes
    const gitDiff = await gitManager.diff();
    expect(gitDiff).toBeDefined();

    // Task Completion Gate
    const completeResult = await taskEngine.completeTask(claimedTask.id, {
      workerId: 'worker-claude',
    });
    expect(completeResult.success).toBe(true);
    expect(completeResult.task.state).toBe('VERIFIED');

    // 15. git.commit creates a commit
    // Stage test file and commit to verify git integration
    const commitRes = await gitManager.commit('feat: implement CoreMath CLI runner verified by harness', ['.vibe-test-e2e/calc.js']);
    expect(commitRes.commitSha).toBeDefined();
    expect(commitRes.commitSha.length).toBe(40);

    // 16. checkpoint.create records the state
    const checkpoint = await checkpointManager.createCheckpoint(project.id, {
      summary: 'Verified CoreMath CLI implementation passing all contract tests',
    });
    expect(checkpoint.id).toBeDefined();
    expect(checkpoint.verifiedCapabilities.length).toBeGreaterThan(0);
    expect(checkpoint.gitCommitSha).toBe(commitRes.commitSha);

    // 17. Simulate a fresh worker
    const freshWorkerId = 'worker-gemini-next';

    // 18. project.resume reconstructs the project state
    const resumeContext = checkpointManager.resumeProject(project.id);

    // 19. The resumed worker knows everything:
    expect(resumeContext.projectId).toBe(project.id);
    expect(resumeContext.checkpointId).toBe(checkpoint.id);
    expect(resumeContext.gitCommitSha).toBe(commitRes.commitSha);
    expect(resumeContext.completedCapabilities).toContain('[VERIFIED] Implement CoreMath CLI Runner');
    expect(resumeContext.nextRecommendedAction).toBeDefined();
    expect(resumeContext.instructionsForWorker).toContain('You are an interchangeable intelligence worker');
  });
});

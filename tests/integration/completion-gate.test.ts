import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteStateStore } from '../../src/storage/sqlite.js';
import { CommandRunner } from '../../src/execution/command-runner.js';
import { GitManager } from '../../src/execution/git-manager.js';
import { ObservableEvidenceCollector } from '../../src/execution/observer.js';
import { VerificationEngine } from '../../src/engine/verification.js';
import { TaskScheduler } from '../../src/engine/scheduler.js';
import { TaskEngine } from '../../src/engine/task-engine.js';
import { Task } from '../../src/models/task.js';

describe('Completion Gate & Automatic Repair Generation', () => {
  let store: SQLiteStateStore;
  let commandRunner: CommandRunner;
  let gitManager: GitManager;
  let observer: ObservableEvidenceCollector;
  let verificationEngine: VerificationEngine;
  let scheduler: TaskScheduler;
  let taskEngine: TaskEngine;

  beforeEach(() => {
    store = new SQLiteStateStore(':memory:');
    commandRunner = new CommandRunner(process.cwd(), store);
    gitManager = new GitManager(process.cwd(), commandRunner);
    observer = new ObservableEvidenceCollector(store);
    verificationEngine = new VerificationEngine(store, gitManager, commandRunner, observer);
    scheduler = new TaskScheduler(store);
    taskEngine = new TaskEngine(store, verificationEngine, scheduler);
  });

  afterEach(() => {
    store.close();
  });

  it('rejects completion and generates a Repair Task when harness fails', async () => {
    const task: Task = {
      id: 'task-broken',
      projectId: 'prj-test',
      title: 'Flaky Feature',
      description: 'Feature with failing harness',
      state: 'READY',
      priority: 'HIGH',
      dependencies: [],
      assignedWorkerId: null,
      claimedAt: null,
      moduleId: null,
      contractSpec: {
        harnessCommand: 'node -e "process.exit(1)"', // Failing harness
        expectedExitCode: 0,
        timeoutMs: 5000,
        evidenceType: 'CLI',
      },
      isRepairTask: false,
      originalFailingTaskId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    };

    store.saveTask(task);

    // Claim
    taskEngine.claimTask('task-broken', 'worker-claude');

    // Attempt to complete
    const result = await taskEngine.completeTask('task-broken', {
      workerId: 'worker-claude',
    });

    expect(result.success).toBe(false);
    expect(result.task.state).toBe('FAILED');
    expect(result.repairTask).toBeDefined();
    expect(result.repairTask?.isRepairTask).toBe(true);
    expect(result.repairTask?.state).toBe('READY');
    expect(result.repairTask?.originalFailingTaskId).toBe('task-broken');

    // The scheduler must immediately offer the repair task next!
    const nextTask = scheduler.getNextTask('prj-test');
    expect(nextTask?.id).toBe(result.repairTask?.id);
    expect(nextTask?.isRepairTask).toBe(true);
  });

  it('transitions to VERIFIED when observable harness satisfies contract', async () => {
    const task: Task = {
      id: 'task-working',
      projectId: 'prj-test',
      title: 'Working Feature',
      description: 'Feature with passing harness',
      state: 'READY',
      priority: 'MEDIUM',
      dependencies: [],
      assignedWorkerId: null,
      claimedAt: null,
      moduleId: null,
      contractSpec: {
        harnessCommand: `node -e 'console.log(JSON.stringify({ status: "ok", value: 100 }))'`,
        expectedExitCode: 0,
        stdoutPattern: '"status":"ok"',
        jsonSchemaCheck: { status: 'ok', value: 100 },
        timeoutMs: 5000,
        evidenceType: 'CLI',
      },
      isRepairTask: false,
      originalFailingTaskId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    };

    store.saveTask(task);
    taskEngine.claimTask('task-working', 'worker-gemini');

    const result = await taskEngine.completeTask('task-working', {
      workerId: 'worker-gemini',
    });

    expect(result.success).toBe(true);
    expect(result.task.state).toBe('VERIFIED');
    expect(result.gateOutcome.passed).toBe(true);
    expect(result.repairTask).toBeUndefined();
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteStateStore } from '../../src/storage/sqlite.js';
import { TaskScheduler } from '../../src/engine/scheduler.js';
import { Task } from '../../src/models/task.js';

describe('TaskScheduler & DAG', () => {
  let store: SQLiteStateStore;
  let scheduler: TaskScheduler;

  beforeEach(() => {
    store = new SQLiteStateStore(':memory:');
    scheduler = new TaskScheduler(store);
  });

  afterEach(() => {
    store.close();
  });

  it('promotes BLOCKED task to READY when all dependencies are VERIFIED', () => {
    const taskA: Task = {
      id: 'task-a',
      projectId: 'prj-1',
      title: 'Foundation Module',
      description: 'First module',
      state: 'VERIFIED',
      priority: 'MEDIUM',
      dependencies: [],
      assignedWorkerId: 'worker-1',
      claimedAt: null,
      moduleId: null,
      isRepairTask: false,
      originalFailingTaskId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    const taskB: Task = {
      id: 'task-b',
      projectId: 'prj-1',
      title: 'Dependent Feature',
      description: 'Second module',
      state: 'BLOCKED',
      priority: 'HIGH',
      dependencies: ['task-a'],
      assignedWorkerId: null,
      claimedAt: null,
      moduleId: null,
      isRepairTask: false,
      originalFailingTaskId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    };

    store.saveTask(taskA);
    store.saveTask(taskB);

    const updated = scheduler.updateTaskReadiness('prj-1');
    expect(updated.length).toBe(1);
    expect(updated[0].id).toBe('task-b');
    expect(updated[0].state).toBe('READY');

    const next = scheduler.getNextTask('prj-1');
    expect(next?.id).toBe('task-b');
  });

  it('prioritizes repair tasks over regular tasks', () => {
    const regularTask: Task = {
      id: 'task-regular',
      projectId: 'prj-1',
      title: 'Regular Feature',
      description: 'Regular work',
      state: 'READY',
      priority: 'HIGH',
      dependencies: [],
      assignedWorkerId: null,
      claimedAt: null,
      moduleId: null,
      isRepairTask: false,
      originalFailingTaskId: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      completedAt: null,
    };

    const repairTask: Task = {
      id: 'task-repair-1',
      projectId: 'prj-1',
      title: 'Repair Failing Test',
      description: 'Fix failure',
      state: 'READY',
      priority: 'CRITICAL',
      dependencies: [],
      assignedWorkerId: null,
      claimedAt: null,
      moduleId: null,
      isRepairTask: true,
      originalFailingTaskId: 'task-prev',
      createdAt: '2026-10-02T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
      completedAt: null,
    };

    store.saveTask(regularTask);
    store.saveTask(repairTask);

    const next = scheduler.getNextTask('prj-1');
    expect(next?.id).toBe('task-repair-1');
    expect(next?.isRepairTask).toBe(true);
  });

  it('detects cycles in task dependencies', () => {
    const task1: Task = {
      id: 't-1',
      projectId: 'prj-1',
      title: 'Task 1',
      description: '',
      state: 'BLOCKED',
      priority: 'LOW',
      dependencies: ['t-2'],
      assignedWorkerId: null,
      claimedAt: null,
      moduleId: null,
      isRepairTask: false,
      originalFailingTaskId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    };

    const task2: Task = {
      id: 't-2',
      projectId: 'prj-1',
      title: 'Task 2',
      description: '',
      state: 'BLOCKED',
      priority: 'LOW',
      dependencies: ['t-1'],
      assignedWorkerId: null,
      claimedAt: null,
      moduleId: null,
      isRepairTask: false,
      originalFailingTaskId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    };

    store.saveTask(task1);
    store.saveTask(task2);

    const validation = scheduler.validateDAG('prj-1');
    expect(validation.isValid).toBe(false);
    expect(validation.cyclePath).toBeDefined();
  });
});

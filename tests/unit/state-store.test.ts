import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteStateStore } from '../../src/storage/sqlite.js';
import { Project } from '../../src/models/project.js';
import { Task } from '../../src/models/task.js';
import { Module } from '../../src/models/module.js';

describe('SQLiteStateStore', () => {
  let store: SQLiteStateStore;

  beforeEach(() => {
    store = new SQLiteStateStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  it('persists and retrieves a project', () => {
    const project: Project = {
      id: 'prj-test-1',
      name: 'Test Project',
      description: 'Test project description',
      rootPath: '/tmp/test',
      status: 'ACTIVE',
      currentPhase: 'V0_FOUNDATION',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { key: 'value' },
    };

    store.saveProject(project);
    const retrieved = store.getProject('prj-test-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe('Test Project');
    expect(retrieved?.metadata).toEqual({ key: 'value' });
  });

  it('persists and retrieves tasks with state machine fields', () => {
    const task: Task = {
      id: 'task-1',
      projectId: 'prj-test-1',
      title: 'Build Module A',
      description: 'Implement initial module',
      state: 'READY',
      priority: 'HIGH',
      dependencies: [],
      assignedWorkerId: null,
      claimedAt: null,
      moduleId: null,
      isRepairTask: false,
      originalFailingTaskId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    };

    store.saveTask(task);
    const retrieved = store.getTask('task-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.state).toBe('READY');
    expect(retrieved?.priority).toBe('HIGH');
  });

  it('persists modules and queries them by project', () => {
    const mod: Module = {
      id: 'mod-calc',
      projectId: 'prj-test-1',
      name: 'Calculator CLI',
      description: 'Performs basic calculations',
      version: '0.1.0',
      entrypoint: 'src/calc.ts',
      observableType: 'CLI',
      harnessCommand: 'node -e "console.log(2+2)"',
      interfaceContractId: null,
      dependencies: [],
      status: 'PLANNED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.saveModule(mod);
    const modules = store.getModulesByProject('prj-test-1');
    expect(modules.length).toBe(1);
    expect(modules[0].name).toBe('Calculator CLI');
  });
});

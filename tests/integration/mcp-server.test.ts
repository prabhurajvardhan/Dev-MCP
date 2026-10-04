import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createVibeMcpServer, VibeMcpContext } from '../../src/server/index.js';

describe('Vibe MCP Server Tools Interface', () => {
  let context: VibeMcpContext;

  beforeEach(() => {
    context = createVibeMcpServer({
      projectRoot: process.cwd(),
      sqlitePath: ':memory:',
    });
  });

  it('exposes all required high-level control plane tool groups', () => {
    expect(context.server).toBeDefined();
    expect(context.projectEngine).toBeDefined();
    expect(context.taskEngine).toBeDefined();
    expect(context.scheduler).toBeDefined();
    expect(context.workspaceManager).toBeDefined();
    expect(context.moduleRunner).toBeDefined();
    expect(context.contractEngine).toBeDefined();
    expect(context.verificationEngine).toBeDefined();
    expect(context.checkpointManager).toBeDefined();
  });

  it('initializes and inspects project through engine and tools', async () => {
    const project = await context.projectEngine.initializeProject(
      'Test Suite Alpha',
      'Autonomous system test',
      process.cwd(),
      'V0_FOUNDATION'
    );

    expect(project.id).toBeDefined();
    const snapshot = await context.projectEngine.inspectProject(project.id);
    expect(snapshot.project.name).toBe('Test Suite Alpha');
    expect(snapshot.taskCounts.total).toBe(0);
    expect(snapshot.nextRecommendedAction).toBeDefined();
  });
});

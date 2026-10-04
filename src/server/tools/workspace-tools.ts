/**
 * MCP Tools: Workspaces
 */
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { WorkspaceManager } from '../../execution/workspace-manager.js';

export function registerWorkspaceTools(
  server: McpServer,
  workspaceManager: WorkspaceManager
) {
  server.registerTool(
    'workspace_create',
    {
      description: 'Creates an isolated workspace and branch for a worker to implement a specific task safely',
      inputSchema: {
        workerId: z.string().describe('Worker identifier'),
        taskId: z.string().describe('ID of the task to be worked on'),
      },
    },
    async ({ workerId, taskId }) => {
      try {
        const workspace = await workspaceManager.createWorkspace(workerId, taskId);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, workspace }, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error creating workspace: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'workspace_status',
    {
      description: 'Returns status of all active worker workspaces',
      inputSchema: {},
    },
    async () => {
      try {
        const workspaces = workspaceManager.getAllWorkspaces();
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ count: workspaces.length, workspaces }, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error fetching workspace status: ${(err as Error).message}` }],
        };
      }
    }
  );
}

/**
 * MCP Tools: Workspaces
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WorkspaceManager } from '../../execution/workspace-manager.js';

export function registerWorkspaceTools(
  server: McpServer,
  workspaceManager: WorkspaceManager
) {
  server.tool(
    'workspace_create',
    'Creates an isolated workspace and branch for a worker to implement a specific task safely',
    {
      workerId: z.string().describe('Worker identifier'),
      taskId: z.string().describe('ID of the task to be worked on'),
    },
    async ({ workerId, taskId }) => {
      try {
        const workspace = await workspaceManager.createWorkspace(workerId, taskId);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, workspace }, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error creating workspace: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.tool(
    'workspace_status',
    'Returns status of all active worker workspaces',
    {},
    async () => {
      try {
        const workspaces = workspaceManager.getAllWorkspaces();
        return {
          content: [{ type: 'text', text: JSON.stringify({ count: workspaces.length, workspaces }, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error fetching workspace status: ${(err as Error).message}` }],
        };
      }
    }
  );
}

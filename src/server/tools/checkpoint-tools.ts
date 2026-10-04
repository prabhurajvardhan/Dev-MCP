/**
 * MCP Tools: Checkpoints
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CheckpointManager } from '../../engine/checkpoint.js';

export function registerCheckpointTools(
  server: McpServer,
  checkpointManager: CheckpointManager
) {
  server.tool(
    'checkpoint_create',
    'Creates a persistent checkpoint recording complete engineering state (git commit SHA, verified capabilities, tasks, failures, observations) for cold resumption',
    {
      projectId: z.string().describe('ID of the project to checkpoint'),
      summary: z.string().optional().describe('Summary description of this checkpoint'),
      cwd: z.string().optional().describe('Optional repository working directory'),
    },
    async ({ projectId, summary, cwd }) => {
      try {
        const checkpoint = await checkpointManager.createCheckpoint(projectId, { summary, cwd });
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, checkpoint }, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Checkpoint creation error: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.tool(
    'checkpoint_load',
    'Loads a specific checkpoint by ID to inspect prior milestone state',
    {
      checkpointId: z.string().describe('ID of the checkpoint to load'),
    },
    async ({ checkpointId }) => {
      try {
        const checkpoint = checkpointManager.loadCheckpoint(checkpointId);
        if (!checkpoint) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Checkpoint ${checkpointId} not found` }],
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(checkpoint, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error loading checkpoint: ${(err as Error).message}` }],
        };
      }
    }
  );
}

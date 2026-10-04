/**
 * MCP Tools: Checkpoints
 */
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { CheckpointManager } from '../../engine/checkpoint.js';

export function registerCheckpointTools(
  server: McpServer,
  checkpointManager: CheckpointManager
) {
  server.registerTool(
    'checkpoint_create',
    {
      description: 'Creates a persistent checkpoint recording complete engineering state (git commit SHA, verified capabilities, tasks, failures, observations) for cold resumption',
      inputSchema: {
        projectId: z.string().describe('ID of the project to checkpoint'),
        summary: z.string().optional().describe('Summary description of this checkpoint'),
        cwd: z.string().optional().describe('Optional repository working directory'),
      },
    },
    async ({ projectId, summary, cwd }) => {
      try {
        const checkpoint = await checkpointManager.createCheckpoint(projectId, { summary, cwd });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, checkpoint }, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Checkpoint creation error: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'checkpoint_load',
    {
      description: 'Loads a specific checkpoint by ID to inspect prior milestone state',
      inputSchema: {
        checkpointId: z.string().describe('ID of the checkpoint to load'),
      },
    },
    async ({ checkpointId }) => {
      try {
        const checkpoint = checkpointManager.loadCheckpoint(checkpointId);
        if (!checkpoint) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Checkpoint ${checkpointId} not found` }],
          };
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(checkpoint, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error loading checkpoint: ${(err as Error).message}` }],
        };
      }
    }
  );
}

/**
 * MCP Tools: Terminal execution scoped to workspace with security policy and logging
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CommandRunner } from '../../execution/command-runner.js';

export function registerTerminalTools(server: McpServer, commandRunner: CommandRunner) {
  server.tool(
    'terminal_exec',
    'Executes a terminal command safely scoped to the project workspace. Evaluates security policies, logs execution history, and captures stdout, stderr, exit code, and execution time.',
    {
      command: z.string().describe('The shell command to execute'),
      cwd: z.string().optional().describe('Relative sub-directory or workspace path (must be inside project root)'),
      timeoutMs: z.number().optional().describe('Execution timeout in milliseconds (defaults to 30000)'),
      projectId: z.string().optional().describe('Optional project ID to associate command logs with'),
    },
    async ({ command, cwd, timeoutMs, projectId }) => {
      try {
        const result = await commandRunner.execute(command, {
          cwd,
          timeoutMs,
          projectId,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Command execution failed: ${(err as Error).message}` }],
        };
      }
    }
  );
}

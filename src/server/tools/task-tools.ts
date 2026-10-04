/**
 * MCP Tools: Tasks, DAG Scheduling, and Completion Gate
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TaskEngine } from '../../engine/task-engine.js';
import { TaskScheduler } from '../../engine/scheduler.js';
import { SQLiteStateStore } from '../../storage/sqlite.js';

export function registerTaskTools(
  server: McpServer,
  taskEngine: TaskEngine,
  taskScheduler: TaskScheduler,
  stateStore: SQLiteStateStore
) {
  server.tool(
    'task_next',
    'Returns the next READY task in the dependency DAG for a worker to claim (prioritizing repair tasks and high priority tasks)',
    {
      projectId: z.string().describe('ID of the project'),
      workerId: z.string().optional().describe('Worker identifier requesting task'),
    },
    async ({ projectId, workerId }) => {
      try {
        const nextTask = taskScheduler.getNextTask(projectId, workerId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  hasNextTask: Boolean(nextTask),
                  task: nextTask,
                  message: nextTask
                    ? `Ready task available: ${nextTask.title} (${nextTask.id})`
                    : 'No tasks currently in READY state. Some may be BLOCKED or all completed.',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error fetching next task: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.tool(
    'task_claim',
    'Claims a READY task for execution by a specific worker model',
    {
      taskId: z.string().describe('ID of the task to claim'),
      workerId: z.string().describe('Identifier of the worker model claiming the task (e.g. claude-3-7, gpt-4o, gemini)'),
    },
    async ({ taskId, workerId }) => {
      try {
        const task = taskEngine.claimTask(taskId, workerId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, task }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error claiming task: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.tool(
    'task_complete',
    'Submits a task for verification through the Completion Gate. Runs tests, executes the observable harness, inspects git diff, and enforces contract rules. If verification fails, an automatic repair task is created.',
    {
      taskId: z.string().describe('ID of the task to complete'),
      workerId: z.string().optional().describe('Worker submitting completion'),
      cwd: z.string().optional().describe('Working directory of the workspace'),
      customTestCommand: z.string().optional().describe('Optional specific test command to execute during gate evaluation'),
    },
    async ({ taskId, workerId, cwd, customTestCommand }) => {
      try {
        const result = await taskEngine.completeTask(taskId, {
          workerId,
          cwd,
          customTestCommand,
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
          content: [{ type: 'text', text: `Error in task completion gate: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.tool(
    'task_fail',
    'Explicitly marks a task as FAILED and records reason',
    {
      taskId: z.string().describe('ID of the task that failed'),
      reason: z.string().describe('Explanation of why the task failed'),
    },
    async ({ taskId, reason }) => {
      try {
        const failed = taskEngine.failTask(taskId, reason);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, task: failed, reason }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Error failing task: ${(err as Error).message}` }],
        };
      }
    }
  );
}

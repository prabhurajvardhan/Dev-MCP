/**
 * MCP Tools: Tasks, DAG Scheduling, and Completion Gate
 */
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { TaskEngine } from '../../engine/task-engine.js';
import { TaskScheduler } from '../../engine/scheduler.js';
import { SQLiteStateStore } from '../../storage/sqlite.js';
import { TaskPrioritySchema, ObservableContractSpecSchema, Task } from '../../models/task.js';
import { generateId, generateTimestamp } from '../../utils/id-gen.js';

export function registerTaskTools(
  server: McpServer,
  taskEngine: TaskEngine,
  taskScheduler: TaskScheduler,
  stateStore: SQLiteStateStore
) {
  server.registerTool(
    'task_create',
    {
      description: 'Creates a new engineering task with dependencies and optional observable contract specification',
      inputSchema: {
        projectId: z.string().describe('ID of the project'),
        title: z.string().describe('Task title'),
        description: z.string().describe('Detailed task description'),
        priority: TaskPrioritySchema.optional().default('MEDIUM'),
        dependencies: z.array(z.string()).optional().default([]),
        moduleId: z.string().optional(),
        contractSpec: ObservableContractSpecSchema.optional(),
      },
    },
    async ({ projectId, title, description, priority, dependencies, moduleId, contractSpec }) => {
      try {
        const taskId = generateId('task');
        const timestamp = generateTimestamp();
        const task: Task = {
          id: taskId,
          projectId,
          title,
          description,
          state: (dependencies && dependencies.length > 0) ? 'BLOCKED' : 'READY',
          priority: priority || 'MEDIUM',
          dependencies: dependencies || [],
          assignedWorkerId: null,
          claimedAt: null,
          moduleId: moduleId || null,
          contractSpec,
          isRepairTask: false,
          originalFailingTaskId: null,
          createdAt: timestamp,
          updatedAt: timestamp,
          completedAt: null,
        };

        stateStore.saveTask(task);
        taskScheduler.updateTaskReadiness(projectId);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ success: true, task }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error creating task: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'task_next',
    {
      description: 'Returns the next READY task in the dependency DAG for a worker to claim (prioritizing repair tasks and high priority tasks)',
      inputSchema: {
        projectId: z.string().describe('ID of the project'),
        workerId: z.string().optional().describe('Worker identifier requesting task'),
      },
    },
    async ({ projectId, workerId }) => {
      try {
        const nextTask = taskScheduler.getNextTask(projectId, workerId);
        return {
          content: [
            {
              type: 'text' as const,
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
          content: [{ type: 'text' as const, text: `Error fetching next task: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'task_claim',
    {
      description: 'Claims a READY task for execution by a specific worker model',
      inputSchema: {
        taskId: z.string().describe('ID of the task to claim'),
        workerId: z.string().describe('Identifier of the worker model claiming the task (e.g. claude-3-7, gpt-4o, gemini)'),
      },
    },
    async ({ taskId, workerId }) => {
      try {
        const task = taskEngine.claimTask(taskId, workerId);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ success: true, task }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error claiming task: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'task_complete',
    {
      description: 'Submits a task for verification through the Completion Gate. Runs tests, executes the observable harness, inspects git diff, and enforces contract rules. If verification fails, an automatic repair task is created.',
      inputSchema: {
        taskId: z.string().describe('ID of the task to complete'),
        workerId: z.string().optional().describe('Worker submitting completion'),
        cwd: z.string().optional().describe('Working directory of the workspace'),
        customTestCommand: z.string().optional().describe('Optional specific test command to execute during gate evaluation'),
      },
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
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error in task completion gate: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'task_fail',
    {
      description: 'Explicitly marks a task as FAILED and records reason',
      inputSchema: {
        taskId: z.string().describe('ID of the task that failed'),
        reason: z.string().describe('Explanation of why the task failed'),
      },
    },
    async ({ taskId, reason }) => {
      try {
        const failed = taskEngine.failTask(taskId, reason);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ success: true, task: failed, reason }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error failing task: ${(err as Error).message}` }],
        };
      }
    }
  );
}

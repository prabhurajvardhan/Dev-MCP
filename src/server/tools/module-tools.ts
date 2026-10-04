/**
 * MCP Tools: Module execution and Observable evidence collection
 */
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ModuleRunner } from '../../execution/module-runner.js';
import { ObservableEvidenceCollector } from '../../execution/observer.js';
import { ObservableTypeSchema } from '../../models/module.js';

export function registerModuleTools(
  server: McpServer,
  moduleRunner: ModuleRunner,
  observer: ObservableEvidenceCollector
) {
  server.registerTool(
    'module_run',
    {
      description: 'Executes a module through its registered runnable harness, capturing full execution output and telemetry',
      inputSchema: {
        moduleId: z.string().describe('ID of the module to execute'),
        inputArgs: z.string().optional().describe('Arguments or inputs to pass to the module harness'),
        customHarness: z.string().optional().describe('Alternative harness command override'),
        cwd: z.string().optional().describe('Optional working directory'),
        taskId: z.string().optional().describe('Optional task ID to associate observation with'),
      },
    },
    async ({ moduleId, inputArgs, customHarness, cwd, taskId }) => {
      try {
        const runResult = await moduleRunner.run(moduleId, {
          inputArgs,
          customHarness,
          cwd,
          taskId,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(runResult, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Module execution failed: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'module_observe',
    {
      description: 'Captures and records reproducible observable evidence from an executed command or system state',
      inputSchema: {
        command: z.string().describe('The command or harness that was observed'),
        exitCode: z.number().describe('Exit code resulting from execution'),
        stdout: z.string().describe('Standard output captured'),
        stderr: z.string().describe('Standard error captured'),
        executionTimeMs: z.number().describe('Duration of execution in milliseconds'),
        evidenceType: ObservableTypeSchema.optional().describe('Observation modality (CLI, HTTP_API, DATABASE, etc.)'),
        taskId: z.string().optional().describe('Associated task ID'),
        moduleId: z.string().optional().describe('Associated module ID'),
        artifactPaths: z.array(z.string()).optional().describe('File paths of generated artifacts to hash and verify'),
      },
    },
    async ({ command, exitCode, stdout, stderr, executionTimeMs, evidenceType, taskId, moduleId, artifactPaths }) => {
      try {
        const evidence = observer.collect({
          command,
          exitCode,
          stdout,
          stderr,
          executionTimeMs,
          evidenceType,
          taskId,
          moduleId,
          artifactPaths,
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, evidence }, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Observation recording failed: ${(err as Error).message}` }],
        };
      }
    }
  );
}

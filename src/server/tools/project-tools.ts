/**
 * MCP Tools: Project lifecycle, Requirements, and Architecture
 */
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ProjectEngine } from '../../engine/project-engine.js';
import { CheckpointManager } from '../../engine/checkpoint.js';

export function registerProjectTools(
  server: McpServer,
  projectEngine: ProjectEngine,
  checkpointManager: CheckpointManager
) {
  server.registerTool(
    'project_initialize',
    {
      description: 'Initializes or connects to a Vibe Engineering Project with SQLite operational state and .vibe/ directory',
      inputSchema: {
        name: z.string().describe('Project name'),
        description: z.string().describe('Detailed project description and purpose'),
        rootPath: z.string().optional().describe('Project root directory path (defaults to current working directory)'),
        initialPhase: z.string().optional().describe('Initial development phase (e.g. V0_FOUNDATION)'),
      },
    },
    async ({ name, description, rootPath, initialPhase }) => {
      try {
        const project = await projectEngine.initializeProject(name, description, rootPath, initialPhase);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ success: true, project }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error initializing project: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'project_inspect',
    {
      description: 'Returns a full high-density status report of the engineering control plane (tasks, modules, git state, checkpoint)',
      inputSchema: {
        projectId: z.string().describe('ID of the project to inspect'),
      },
    },
    async ({ projectId }) => {
      try {
        const snapshot = await projectEngine.inspectProject(projectId);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(snapshot, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error inspecting project: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'project_resume',
    {
      description: 'Provides complete, high-density continuation context for a fresh worker model resuming development',
      inputSchema: {
        projectId: z.string().describe('ID of the project to resume'),
      },
    },
    async ({ projectId }) => {
      try {
        const context = checkpointManager.resumeProject(projectId);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(context, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error resuming project: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'requirements_compile',
    {
      description: 'Compiles human-level product specifications into structured engineering capabilities and acceptance criteria',
      inputSchema: {
        projectId: z.string().describe('ID of the project'),
        title: z.string().describe('Specification title'),
        goals: z.array(z.string()).describe('High-level engineering goals'),
        capabilities: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              acceptanceCriteria: z.array(z.string()),
            })
          )
          .describe('Structured capabilities list'),
      },
    },
    async ({ projectId, title, goals, capabilities }) => {
      try {
        const result = projectEngine.compileRequirements(projectId, { title, goals, capabilities });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error compiling requirements: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'architecture_generate',
    {
      description: 'Synthesizes and records system design, modular boundaries, observable entrypoints, and contracts',
      inputSchema: {
        projectId: z.string().describe('ID of the project'),
        systemDesign: z.string().describe('Architecture overview and design principles'),
        modules: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              observableType: z.string(),
              entrypoint: z.string(),
            })
          )
          .describe('Modules list'),
        interfaces: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              contract: z.string(),
            })
          )
          .describe('Interfaces list'),
        dependencies: z
          .array(
            z.object({
              from: z.string(),
              to: z.string(),
            })
          )
          .describe('Inter-module dependency connections'),
      },
    },
    async ({ projectId, systemDesign, modules, interfaces, dependencies }) => {
      try {
        const result = projectEngine.generateArchitecture(projectId, {
          systemDesign,
          modules,
          interfaces,
          dependencies,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error generating architecture: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'architecture_validate',
    {
      description: 'Validates architecture DAG consistency, cycle prevention, and interface completeness',
      inputSchema: {
        projectId: z.string().describe('ID of the project to validate'),
      },
    },
    async ({ projectId }) => {
      try {
        const validation = projectEngine.validateArchitecture(projectId);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(validation, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error validating architecture: ${(err as Error).message}` }],
        };
      }
    }
  );
}

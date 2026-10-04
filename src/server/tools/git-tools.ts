/**
 * MCP Tools: Git version control operations
 */
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { GitManager } from '../../execution/git-manager.js';

export function registerGitTools(server: McpServer, gitManager: GitManager) {
  server.registerTool(
    'git_status',
    {
      description: 'Returns git working tree status, staged files, modified files, untracked files, and current branch',
      inputSchema: {
        cwd: z.string().optional().describe('Optional repository working directory'),
      },
    },
    async ({ cwd }) => {
      try {
        const status = await gitManager.status(cwd);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Git status error: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'git_diff',
    {
      description: 'Returns git diff of modified files or staged changes',
      inputSchema: {
        staged: z.boolean().optional().describe('Whether to inspect staged changes (--cached)'),
        file: z.string().optional().describe('Specific file path to diff'),
        cwd: z.string().optional().describe('Optional repository working directory'),
      },
    },
    async ({ staged, file, cwd }) => {
      try {
        const diffResult = await gitManager.diff({ staged, file, cwd });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(diffResult, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Git diff error: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'git_commit',
    {
      description: 'Stages changes and creates a git commit with structured message',
      inputSchema: {
        message: z.string().describe('Git commit message'),
        files: z.array(z.string()).optional().describe('Specific files to stage and commit (defaults to all modified/untracked files)'),
        cwd: z.string().optional().describe('Optional repository working directory'),
      },
    },
    async ({ message, files, cwd }) => {
      try {
        const result = await gitManager.commit(message, files, cwd);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, ...result }, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Git commit error: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'git_branch',
    {
      description: 'Creates and checks out a new branch',
      inputSchema: {
        branchName: z.string().describe('Name of the branch to create'),
        startPoint: z.string().optional().describe('Optional starting commit or branch'),
        cwd: z.string().optional().describe('Optional repository working directory'),
      },
    },
    async ({ branchName, startPoint, cwd }) => {
      try {
        const created = await gitManager.createBranch(branchName, startPoint, cwd);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, branch: created }, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Git branch error: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'git_merge',
    {
      description: 'Merges specified branch into current branch with --no-ff',
      inputSchema: {
        branchName: z.string().describe('Name of the branch to merge'),
        cwd: z.string().optional().describe('Optional repository working directory'),
      },
    },
    async ({ branchName, cwd }) => {
      try {
        const result = await gitManager.merge(branchName, cwd);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Git merge error: ${(err as Error).message}` }],
        };
      }
    }
  );
}

/**
 * MCP Tools: Git version control operations
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { GitManager } from '../../execution/git-manager.js';

export function registerGitTools(server: McpServer, gitManager: GitManager) {
  server.tool(
    'git_status',
    'Returns git working tree status, staged files, modified files, untracked files, and current branch',
    {
      cwd: z.string().optional().describe('Optional repository working directory'),
    },
    async ({ cwd }) => {
      try {
        const status = await gitManager.status(cwd);
        return {
          content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Git status error: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.tool(
    'git_diff',
    'Returns git diff of modified files or staged changes',
    {
      staged: z.boolean().optional().describe('Whether to inspect staged changes (--cached)'),
      file: z.string().optional().describe('Specific file path to diff'),
      cwd: z.string().optional().describe('Optional repository working directory'),
    },
    async ({ staged, file, cwd }) => {
      try {
        const diffResult = await gitManager.diff({ staged, file, cwd });
        return {
          content: [{ type: 'text', text: JSON.stringify(diffResult, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Git diff error: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.tool(
    'git_commit',
    'Stages changes and creates a git commit with structured message',
    {
      message: z.string().describe('Git commit message'),
      files: z.array(z.string()).optional().describe('Specific files to stage and commit (defaults to all modified/untracked files)'),
      cwd: z.string().optional().describe('Optional repository working directory'),
    },
    async ({ message, files, cwd }) => {
      try {
        const result = await gitManager.commit(message, files, cwd);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, ...result }, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Git commit error: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.tool(
    'git_branch',
    'Creates and checks out a new branch',
    {
      branchName: z.string().describe('Name of the branch to create'),
      startPoint: z.string().optional().describe('Optional starting commit or branch'),
      cwd: z.string().optional().describe('Optional repository working directory'),
    },
    async ({ branchName, startPoint, cwd }) => {
      try {
        const created = await gitManager.createBranch(branchName, startPoint, cwd);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, branch: created }, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Git branch error: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.tool(
    'git_merge',
    'Merges specified branch into current branch with --no-ff',
    {
      branchName: z.string().describe('Name of the branch to merge'),
      cwd: z.string().optional().describe('Optional repository working directory'),
    },
    async ({ branchName, cwd }) => {
      try {
        const result = await gitManager.merge(branchName, cwd);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Git merge error: ${(err as Error).message}` }],
        };
      }
    }
  );
}

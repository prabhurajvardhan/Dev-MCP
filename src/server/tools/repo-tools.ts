/**
 * MCP Tools: Repository file operations with strict path policy enforcement
 */
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { PathPolicy } from '../../security/path-policy.js';

export function registerRepoTools(server: McpServer, pathPolicy: PathPolicy) {
  server.registerTool(
    'repo_read_file',
    {
      description: 'Safely reads a file within the project workspace. Traversal outside workspace is blocked.',
      inputSchema: {
        filePath: z.string().describe('Relative path to the file within the repository'),
        workspaceRoot: z.string().optional().describe('Optional custom workspace root directory'),
      },
    },
    async ({ filePath, workspaceRoot }) => {
      try {
        const safePath = pathPolicy.resolveSafePath(filePath, workspaceRoot);
        if (!fs.existsSync(safePath)) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `File not found: ${filePath}` }],
          };
        }

        const content = fs.readFileSync(safePath, 'utf8');
        return {
          content: [{ type: 'text' as const, text: content }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error reading file: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'repo_write_file',
    {
      description: 'Safely writes or updates a file within the project workspace, ensuring parent directories exist.',
      inputSchema: {
        filePath: z.string().describe('Relative path to the file within the repository'),
        content: z.string().describe('Full content to write to the file'),
        workspaceRoot: z.string().optional().describe('Optional custom workspace root directory'),
      },
    },
    async ({ filePath, content, workspaceRoot }) => {
      try {
        const safePath = pathPolicy.resolveSafePath(filePath, workspaceRoot);
        const dir = path.dirname(safePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(safePath, content, 'utf8');
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ success: true, filePath, bytesWritten: Buffer.byteLength(content) }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error writing file: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.registerTool(
    'repo_delete_file',
    {
      description: 'Safely deletes a file within the project workspace.',
      inputSchema: {
        filePath: z.string().describe('Relative path to the file within the repository'),
        workspaceRoot: z.string().optional().describe('Optional custom workspace root directory'),
      },
    },
    async ({ filePath, workspaceRoot }) => {
      try {
        const safePath = pathPolicy.resolveSafePath(filePath, workspaceRoot);
        if (!fs.existsSync(safePath)) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `File not found: ${filePath}` }],
          };
        }

        fs.unlinkSync(safePath);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ success: true, deletedPath: filePath }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error deleting file: ${(err as Error).message}` }],
        };
      }
    }
  );
}

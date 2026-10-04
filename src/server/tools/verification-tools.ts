/**
 * MCP Tools: Contract and Integration Verification
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ContractEngine } from '../../engine/contracts.js';
import { IntegrationManager } from '../../engine/integration.js';
import { SQLiteStateStore } from '../../storage/sqlite.js';

export function registerVerificationTools(
  server: McpServer,
  contractEngine: ContractEngine,
  integrationManager: IntegrationManager,
  stateStore: SQLiteStateStore
) {
  server.tool(
    'contract_verify',
    'Validates collected observable evidence against contract rules (exit codes, output regex, JSON schema, artifacts)',
    {
      contractId: z.string().describe('ID of the contract to verify against'),
      evidenceId: z.string().optional().describe('ID of the stored evidence to verify'),
      taskId: z.string().optional().describe('Task ID to fetch latest evidence for'),
    },
    async ({ contractId, evidenceId, taskId }) => {
      try {
        const contract = stateStore.getContract(contractId);
        if (!contract) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Contract ${contractId} not found` }],
          };
        }

        let evidence;
        if (taskId) {
          const evidenceList = stateStore.getEvidenceByTask(taskId);
          if (evidenceList.length > 0) {
            evidence = evidenceList[0];
          }
        }

        if (!evidence) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'No evidence found to verify against contract' }],
          };
        }

        const result = contractEngine.verifyEvidenceAgainstContract(contract, evidence);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Contract verification error: ${(err as Error).message}` }],
        };
      }
    }
  );

  server.tool(
    'integration_verify',
    'Executes end-to-end integration harness across multiple modules to verify complete system behavior',
    {
      projectId: z.string().describe('ID of the project'),
      name: z.string().describe('Name of the integration test'),
      description: z.string().describe('Description of cross-module interaction being verified'),
      modulesInvolved: z.array(z.string()).describe('List of module IDs involved'),
      integrationCommand: z.string().describe('Command to run integration test suite'),
      expectedPattern: z.string().optional().describe('Regex pattern expected in output'),
      cwd: z.string().optional().describe('Optional working directory'),
    },
    async ({ projectId, name, description, modulesInvolved, integrationCommand, expectedPattern, cwd }) => {
      try {
        const result = await integrationManager.verifyIntegration(
          projectId,
          {
            name,
            description,
            modulesInvolved,
            integrationCommand,
            expectedPattern,
          },
          cwd
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Integration verification error: ${(err as Error).message}` }],
        };
      }
    }
  );
}

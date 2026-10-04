/**
 * Contract evaluation engine
 */
import fs from 'node:fs';
import { Contract, ContractRule, ObservableEvidence, VerificationResult } from '../models/contract.js';
import { generateTimestamp } from '../utils/id-gen.js';
import { Logger } from '../utils/logger.js';

export class ContractEngine {
  private logger = new Logger('ContractEngine');

  verifyEvidenceAgainstContract(contract: Contract, evidence: ObservableEvidence): VerificationResult {
    const failures: string[] = [];

    for (const rule of contract.rules) {
      const ruleFailure = this.evaluateRule(rule, evidence);
      if (ruleFailure) {
        failures.push(ruleFailure);
      }
    }

    const passed = failures.length === 0;
    return {
      passed,
      contractId: contract.id,
      taskId: evidence.taskId,
      evidence,
      failures,
      verifiedAt: generateTimestamp(),
    };
  }

  private evaluateRule(rule: ContractRule, evidence: ObservableEvidence): string | null {
    switch (rule.type) {
      case 'EXIT_CODE': {
        const expected = Number(rule.expected);
        if (evidence.exitCode !== expected) {
          return rule.message || `Expected exit code ${expected}, received ${evidence.exitCode}`;
        }
        return null;
      }

      case 'STDOUT_CONTAINS': {
        const expected = String(rule.expected);
        if (!evidence.stdout.includes(expected)) {
          return rule.message || `Stdout did not contain expected text: "${expected}"`;
        }
        return null;
      }

      case 'STDOUT_MATCHES': {
        const regex = new RegExp(String(rule.expected));
        if (!regex.test(evidence.stdout)) {
          return rule.message || `Stdout did not match pattern: ${rule.expected}`;
        }
        return null;
      }

      case 'ARTIFACT_EXISTS': {
        const targetPath = String(rule.expected);
        if (!fs.existsSync(targetPath)) {
          return rule.message || `Expected artifact at "${targetPath}" does not exist`;
        }
        return null;
      }

      case 'JSON_SCHEMA': {
        try {
          const parsed = JSON.parse(evidence.stdout);
          const expectedFields = rule.expected as Record<string, unknown>;
          for (const [key, val] of Object.entries(expectedFields)) {
            if (!(key in parsed)) {
              return `JSON output missing required key "${key}"`;
            }
            if (val !== undefined && parsed[key] !== val && typeof val !== 'object') {
              return `JSON output key "${key}" expected value "${val}", got "${parsed[key]}"`;
            }
          }
        } catch (err) {
          return `Stdout is not valid JSON: ${(err as Error).message}`;
        }
        return null;
      }

      default:
        return `Unsupported contract rule type: ${rule.type}`;
    }
  }
}

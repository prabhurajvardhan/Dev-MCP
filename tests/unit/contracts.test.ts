import { describe, it, expect } from 'vitest';
import { ContractEngine } from '../../src/engine/contracts.js';
import { Contract, ObservableEvidence } from '../../src/models/contract.js';

describe('ContractEngine', () => {
  const engine = new ContractEngine();

  it('validates exit code and stdout regex rule', () => {
    const contract: Contract = {
      id: 'ctr-1',
      projectId: 'prj-1',
      name: 'Calculator Contract',
      description: 'Sum two numbers',
      moduleId: 'mod-1',
      inputDescription: 'Two numbers',
      expectedBehavior: 'Outputs numeric sum',
      rules: [
        { type: 'EXIT_CODE', expected: 0 },
        { type: 'STDOUT_CONTAINS', expected: 'SUM=42' },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const validEvidence: ObservableEvidence = {
      id: 'ev-1',
      command: 'node calc.js 40 2',
      exitCode: 0,
      stdout: 'Result calculated: SUM=42\n',
      stderr: '',
      executionTimeMs: 120,
      evidenceType: 'CLI',
      capturedArtifacts: [],
      capturedAt: new Date().toISOString(),
      metadata: {},
    };

    const res = engine.verifyEvidenceAgainstContract(contract, validEvidence);
    expect(res.passed).toBe(true);
    expect(res.failures.length).toBe(0);

    const failingEvidence: ObservableEvidence = {
      id: 'ev-2',
      command: 'node calc.js 40 2',
      exitCode: 1,
      stdout: 'SUM=99',
      stderr: 'Error occurred',
      executionTimeMs: 120,
      evidenceType: 'CLI',
      capturedArtifacts: [],
      capturedAt: new Date().toISOString(),
      metadata: {},
    };

    const failRes = engine.verifyEvidenceAgainstContract(contract, failingEvidence);
    expect(failRes.passed).toBe(false);
    expect(failRes.failures.length).toBe(2);
  });

  it('validates JSON output schema rules', () => {
    const contract: Contract = {
      id: 'ctr-json',
      projectId: 'prj-1',
      name: 'JSON API Contract',
      description: 'Structured output contract',
      moduleId: 'mod-json',
      inputDescription: 'Request',
      expectedBehavior: 'JSON with status ok',
      rules: [
        { type: 'JSON_SCHEMA', expected: { status: 'ok', count: 10 } },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const evidence: ObservableEvidence = {
      id: 'ev-json',
      command: 'node api.js',
      exitCode: 0,
      stdout: JSON.stringify({ status: 'ok', count: 10, items: [] }),
      stderr: '',
      executionTimeMs: 50,
      evidenceType: 'CLI',
      capturedArtifacts: [],
      capturedAt: new Date().toISOString(),
      metadata: {},
    };

    const res = engine.verifyEvidenceAgainstContract(contract, evidence);
    expect(res.passed).toBe(true);
  });
});

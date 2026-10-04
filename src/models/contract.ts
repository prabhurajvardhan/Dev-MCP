/**
 * Contract and Observable Evidence definitions
 */
import { z } from 'zod';
import { ObservableTypeSchema } from './module.js';

export const ObservableEvidenceSchema = z.object({
  id: z.string(),
  taskId: z.string().optional(),
  moduleId: z.string().optional(),
  command: z.string(),
  exitCode: z.number(),
  stdout: z.string(),
  stderr: z.string(),
  executionTimeMs: z.number(),
  evidenceType: ObservableTypeSchema.default('CLI'),
  capturedArtifacts: z.array(z.string()).default([]),
  capturedAt: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type ObservableEvidence = z.infer<typeof ObservableEvidenceSchema>;

export const ContractRuleSchema = z.object({
  type: z.enum(['EXIT_CODE', 'STDOUT_CONTAINS', 'STDOUT_MATCHES', 'JSON_SCHEMA', 'ARTIFACT_EXISTS']),
  expected: z.unknown(),
  message: z.string().optional(),
});
export type ContractRule = z.infer<typeof ContractRuleSchema>;

export const ContractSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  description: z.string(),
  moduleId: z.string().nullable().default(null),
  inputDescription: z.string(),
  expectedBehavior: z.string(),
  rules: z.array(ContractRuleSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Contract = z.infer<typeof ContractSchema>;

export const VerificationResultSchema = z.object({
  passed: z.boolean(),
  contractId: z.string().optional(),
  taskId: z.string().optional(),
  evidence: ObservableEvidenceSchema.optional(),
  failures: z.array(z.string()).default([]),
  verifiedAt: z.string(),
});
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

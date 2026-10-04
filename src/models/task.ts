/**
 * Task models, state transitions and schemas
 */
import { z } from 'zod';
import { ObservableTypeSchema } from './module.js';

export const TaskStateSchema = z.enum([
  'BLOCKED',
  'READY',
  'CLAIMED',
  'BUILDING',
  'VERIFYING',
  'VERIFIED',
  'INTEGRATING',
  'FAILED',
]);
export type TaskState = z.infer<typeof TaskStateSchema>;

export const TaskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const ObservableContractSpecSchema = z.object({
  harnessCommand: z.string(),
  expectedExitCode: z.number().default(0),
  stdoutPattern: z.string().optional(),
  jsonSchemaCheck: z.record(z.string(), z.unknown()).optional(),
  timeoutMs: z.number().default(15000),
  evidenceType: ObservableTypeSchema.default('CLI'),
});
export type ObservableContractSpec = z.infer<typeof ObservableContractSpecSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string(),
  state: TaskStateSchema.default('BLOCKED'),
  priority: TaskPrioritySchema.default('MEDIUM'),
  dependencies: z.array(z.string()).default([]), // IDs of tasks that must be VERIFIED
  assignedWorkerId: z.string().nullable().default(null),
  claimedAt: z.string().nullable().default(null),
  moduleId: z.string().nullable().default(null),
  contractSpec: ObservableContractSpecSchema.optional(),
  isRepairTask: z.boolean().default(false),
  originalFailingTaskId: z.string().nullable().default(null),
  repairContext: z.object({
    failureReason: z.string(),
    failingCommand: z.string().optional(),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    affectedFiles: z.array(z.string()).default([]),
    suggestedAction: z.string().optional(),
  }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable().default(null),
});
export type Task = z.infer<typeof TaskSchema>;

export const ALLOWED_TRANSITIONS: Record<TaskState, TaskState[]> = {
  BLOCKED: ['READY'],
  READY: ['CLAIMED', 'BLOCKED'],
  CLAIMED: ['BUILDING', 'READY'],
  BUILDING: ['VERIFYING', 'FAILED'],
  VERIFYING: ['VERIFIED', 'FAILED'],
  VERIFIED: ['INTEGRATING', 'READY'],
  INTEGRATING: ['VERIFIED', 'FAILED'],
  FAILED: ['READY', 'BUILDING'],
};

/**
 * Checkpoint and Resume schemas for Vibe Engineering MCP
 */
import { z } from 'zod';

export const CheckpointSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  gitCommitSha: z.string(),
  phase: z.string(),
  summary: z.string(),
  verifiedCapabilities: z.array(z.string()).default([]),
  activeTasks: z.array(z.string()).default([]),
  readyTasks: z.array(z.string()).default([]),
  blockedTasks: z.array(z.string()).default([]),
  workerAssignments: z.record(z.string(), z.string()).default({}), // workerId -> taskId
  workspaceInfo: z.record(z.string(), z.unknown()).default({}),
  latestObservations: z.array(z.record(z.string(), z.unknown())).default([]),
  failures: z.array(z.record(z.string(), z.unknown())).default([]),
  architectureDecisions: z.array(z.string()).default([]),
  interfaceVersions: z.record(z.string(), z.string()).default({}),
  integrationStatus: z.string().default('HEALTHY'),
  nextRecommendedAction: z.string(),
  runtimeCommands: z.array(z.string()).default([]),
  filesTouched: z.array(z.string()).default([]),
  createdAt: z.string(),
});
export type Checkpoint = z.infer<typeof CheckpointSchema>;

export const ResumeContextSchema = z.object({
  projectId: z.string(),
  checkpointId: z.string(),
  gitCommitSha: z.string(),
  currentPhase: z.string(),
  completedCapabilities: z.array(z.string()),
  readyTasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    priority: z.string(),
    description: z.string(),
  })),
  activeTasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    assignedWorkerId: z.string().nullable(),
  })),
  recentFailures: z.array(z.unknown()),
  nextRecommendedAction: z.string(),
  instructionsForWorker: z.string(),
});
export type ResumeContext = z.infer<typeof ResumeContextSchema>;

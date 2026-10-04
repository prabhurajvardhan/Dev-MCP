/**
 * Project model and configuration schemas for Vibe Engineering MCP
 */
import { z } from 'zod';

export const ProjectStatusSchema = z.enum([
  'INITIALIZING',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'ARCHIVED',
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  rootPath: z.string(),
  status: ProjectStatusSchema.default('ACTIVE'),
  currentPhase: z.string().default('V0_FOUNDATION'),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectInitializeInputSchema = z.object({
  name: z.string(),
  description: z.string(),
  rootPath: z.string().optional(),
  initialPhase: z.string().optional().default('V0_FOUNDATION'),
});
export type ProjectInitializeInput = z.infer<typeof ProjectInitializeInputSchema>;

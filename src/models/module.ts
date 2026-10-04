/**
 * Module model representing software units with observable entrypoints
 */
import { z } from 'zod';

export const ObservableTypeSchema = z.enum([
  'CLI',
  'HTTP_API',
  'DATABASE',
  'FILE_SYSTEM',
  'BROWSER_UI',
  'STRUCTURED_AI',
]);
export type ObservableType = z.infer<typeof ObservableTypeSchema>;

export const ModuleSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string().default('0.1.0'),
  entrypoint: z.string(),
  observableType: ObservableTypeSchema.default('CLI'),
  harnessCommand: z.string(),
  interfaceContractId: z.string().nullable().default(null),
  dependencies: z.array(z.string()).default([]),
  status: z.enum(['PLANNED', 'BUILDING', 'VERIFIED', 'DEPRECATED']).default('PLANNED'),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Module = z.infer<typeof ModuleSchema>;

/**
 * Worker model for interchangeable AI models (Claude, GPT, Gemini, Mistral, Llama, local)
 */
import { z } from 'zod';

export const WorkerSchema = z.object({
  id: z.string(),
  modelName: z.string(),
  provider: z.string().default('unknown'),
  status: z.enum(['IDLE', 'BUSY', 'OFFLINE']).default('IDLE'),
  assignedTaskId: z.string().nullable().default(null),
  workspacePath: z.string().nullable().default(null),
  lastActiveAt: z.string(),
});
export type Worker = z.infer<typeof WorkerSchema>;

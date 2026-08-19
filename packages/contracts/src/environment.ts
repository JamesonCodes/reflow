import { z } from 'zod';

export const browserEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.url().startsWith('https://'),
});

export const adminEnvironmentSchema = browserEnvironmentSchema.extend({
  REFLOW_ADMIN_EMAILS: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export const workerEnvironmentSchema = z.object({
  AI_GATEWAY_API_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.url().startsWith('https://'),
  REFLOW_TASK_INFERENCE_MODEL: z
    .string()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9-]+\/[a-z0-9._-]+$/i),
  REFLOW_PROCESS_MINING_MODEL: z
    .string()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9-]+\/[a-z0-9._-]+$/i),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export const trustedEnvironmentSchema = adminEnvironmentSchema.extend({
  AI_GATEWAY_API_KEY: z.string().min(1),
  REFLOW_TASK_INFERENCE_MODEL:
    workerEnvironmentSchema.shape.REFLOW_TASK_INFERENCE_MODEL,
  REFLOW_PROCESS_MINING_MODEL:
    workerEnvironmentSchema.shape.REFLOW_PROCESS_MINING_MODEL,
});

export type AdminEnvironment = z.infer<typeof adminEnvironmentSchema>;
export type BrowserEnvironment = z.infer<typeof browserEnvironmentSchema>;
export type TrustedEnvironment = z.infer<typeof trustedEnvironmentSchema>;
export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>;

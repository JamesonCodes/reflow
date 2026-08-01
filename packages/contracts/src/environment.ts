import { z } from 'zod';

export const browserEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.url().startsWith('https://'),
});

export const trustedEnvironmentSchema = browserEnvironmentSchema.extend({
  AI_GATEWAY_API_KEY: z.string().min(1),
  REFLOW_ADMIN_EMAILS: z.string().min(1),
  REFLOW_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive(),
  REFLOW_EMBEDDING_MODEL: z.string().min(1),
  REFLOW_EMBEDDING_VERSION: z.coerce.number().int().positive(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type BrowserEnvironment = z.infer<typeof browserEnvironmentSchema>;
export type TrustedEnvironment = z.infer<typeof trustedEnvironmentSchema>;

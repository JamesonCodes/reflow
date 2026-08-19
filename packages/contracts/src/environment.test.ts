import { describe, expect, it } from 'vitest';

import {
  adminEnvironmentSchema,
  browserEnvironmentSchema,
  trustedEnvironmentSchema,
  workerEnvironmentSchema,
} from './environment';

const browserEnvironment = {
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
};

describe('environment schemas', () => {
  it('accepts browser-safe Supabase configuration', () => {
    expect(browserEnvironmentSchema.parse(browserEnvironment)).toEqual(
      browserEnvironment,
    );
  });

  it('accepts trusted worker settings', () => {
    const result = trustedEnvironmentSchema.parse({
      ...browserEnvironment,
      AI_GATEWAY_API_KEY: 'gateway-key',
      REFLOW_ADMIN_EMAILS: 'analyst@example.com',
      REFLOW_PROCESS_MINING_MODEL: 'openai/gpt-5-mini',
      REFLOW_TASK_INFERENCE_MODEL: 'openai/gpt-5-mini',
      SUPABASE_SECRET_KEY: 'secret-key',
    });

    expect(result.SUPABASE_SECRET_KEY).toBe('secret-key');
  });

  it('requires a provider-neutral task inference model for the worker', () => {
    expect(
      workerEnvironmentSchema.parse({
        AI_GATEWAY_API_KEY: 'gateway-key',
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        REFLOW_TASK_INFERENCE_MODEL: 'anthropic/claude-haiku-4.5',
        REFLOW_PROCESS_MINING_MODEL: 'openai/gpt-5-mini',
        SUPABASE_SECRET_KEY: 'secret-key',
      }).REFLOW_TASK_INFERENCE_MODEL,
    ).toBe('anthropic/claude-haiku-4.5');
  });

  it('validates local admin settings without requiring model access', () => {
    const result = adminEnvironmentSchema.parse({
      ...browserEnvironment,
      REFLOW_ADMIN_EMAILS: 'analyst@example.com',
      SUPABASE_SECRET_KEY: 'secret-key',
    });

    expect(result.REFLOW_ADMIN_EMAILS).toBe('analyst@example.com');
  });
});

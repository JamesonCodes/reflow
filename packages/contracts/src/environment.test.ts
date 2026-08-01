import { describe, expect, it } from 'vitest';

import {
  browserEnvironmentSchema,
  trustedEnvironmentSchema,
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

  it('coerces numeric worker settings', () => {
    const result = trustedEnvironmentSchema.parse({
      ...browserEnvironment,
      AI_GATEWAY_API_KEY: 'gateway-key',
      REFLOW_ADMIN_EMAILS: 'analyst@example.com',
      REFLOW_EMBEDDING_DIMENSIONS: '1024',
      REFLOW_EMBEDDING_MODEL: 'mistral/mistral-embed',
      REFLOW_EMBEDDING_VERSION: '1',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    });

    expect(result.REFLOW_EMBEDDING_DIMENSIONS).toBe(1024);
    expect(result.REFLOW_EMBEDDING_VERSION).toBe(1);
  });
});

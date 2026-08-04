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
      SUPABASE_SECRET_KEY: 'secret-key',
    });

    expect(result.SUPABASE_SECRET_KEY).toBe('secret-key');
  });
});

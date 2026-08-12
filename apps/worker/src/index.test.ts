import { describe, expect, it } from 'vitest';

import { startWorker } from './index';

describe('worker configuration', () => {
  it('names the missing task inference model before starting', async () => {
    await expect(
      startWorker({
        AI_GATEWAY_API_KEY: 'gateway-key',
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: 'secret-key',
      }),
    ).rejects.toThrow('REFLOW_TASK_INFERENCE_MODEL');
  });
});

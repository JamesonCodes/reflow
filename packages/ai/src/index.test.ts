import { describe, expect, it } from 'vitest';

import type { NormalizedStep } from '@reflow/contracts';

import { inferBrowserTasks } from './index';

const configuration = {
  apiKey: 'test-gateway-key',
  model: 'openai/gpt-5-mini',
};

const step: NormalizedStep = {
  actionType: 'click',
  boundaryReasons: [],
  candidateBoundaryBefore: false,
  elementLabel: 'Open invoice',
  elementRole: 'link',
  endedAt: '2026-08-12T10:00:00.000Z',
  hostname: 'ap.localhost',
  id: '10000000-0000-4000-8000-000000000001',
  normalizedPath: '/inbox',
  observationWindowId: '10000000-0000-4000-8000-000000000002',
  ordinal: 1,
  pageLandmark: 'Invoice queue',
  semanticInputToken: null,
  sourceEventIds: ['10000000-0000-4000-8000-000000000003'],
  startedAt: '2026-08-12T10:00:00.000Z',
  stepKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  tabId: 1,
  workspaceId: '10000000-0000-4000-8000-000000000004',
};

describe('Vercel AI Gateway task inference adapter', () => {
  it('accepts schema-valid mocked structured output', async () => {
    await expect(
      inferBrowserTasks(
        configuration,
        {
          department: 'Accounts Payable',
          role: 'Invoice analyst',
          steps: [step],
        },
        (_config, prompt) => {
          expect(prompt).not.toContain('rawValue');
          return Promise.resolve({
            tasks: [
              {
                apparentObjective: 'Begin reviewing an invoice',
                boundaryRationale: 'The observer opened an invoice record.',
                confidence: 0.86,
                endStepOrdinal: 1,
                neutralLabel: 'Open invoice for review',
                participatingSystems: ['ap.localhost'],
                startStepOrdinal: 1,
              },
            ],
          });
        },
      ),
    ).resolves.toMatchObject({ tasks: [{ startStepOrdinal: 1 }] });
  });

  it('rejects invalid mocked output before persistence', async () => {
    await expect(
      inferBrowserTasks(
        configuration,
        { department: 'Finance', role: null, steps: [step] },
        () => Promise.resolve({ tasks: [{ label: 'missing evidence' }] }),
      ),
    ).rejects.toThrow('invalid_task_inference_output');
  });
});

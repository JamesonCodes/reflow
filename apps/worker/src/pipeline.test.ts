import { describe, expect, it } from 'vitest';

import type { RawEventForNormalization } from '@reflow/contracts';

import { materializeInference, preprocessObservation } from './pipeline';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const observationWindowId = '10000000-0000-4000-8000-000000000002';

function event(
  sequenceNo: number,
  overrides: Partial<RawEventForNormalization> = {},
): RawEventForNormalization {
  return {
    actionType: 'click',
    elementLabel: 'Open invoice',
    elementRole: 'link',
    hostname: 'ap.localhost',
    id: `10000000-0000-4000-8000-${String(sequenceNo).padStart(12, '0')}`,
    normalizedPath: '/inbox',
    observationWindowId,
    occurredAt: new Date(
      Date.parse('2026-08-12T10:00:00.000Z') + sequenceNo * 1_000,
    ).toISOString(),
    pageLandmark: 'Invoice queue',
    semanticInputToken: null,
    sequenceNo,
    tabId: 1,
    workspaceId,
    ...overrides,
  };
}

describe('deterministic observation preprocessing', () => {
  it('collapses rapid duplicates and preserves their source evidence', () => {
    const result = preprocessObservation([
      event(1),
      event(2, { occurredAt: '2026-08-12T10:00:01.500Z' }),
      event(3, { actionType: 'input', semanticInputToken: '[EMAIL]' }),
    ]);

    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]?.sourceEventIds).toHaveLength(2);
    expect(result.segments).toHaveLength(1);
    expect(preprocessObservation([event(1), event(2)]).digest).toBe(
      preprocessObservation([event(1), event(2)]).digest,
    );
  });

  it('marks candidates but only hard-splits after five minutes', () => {
    const result = preprocessObservation([
      event(1),
      event(2, {
        actionType: 'domain_transition',
        hostname: 'erp.localhost',
        occurredAt: '2026-08-12T10:01:00.000Z',
      }),
      event(3, {
        hostname: 'erp.localhost',
        occurredAt: '2026-08-12T10:07:00.000Z',
      }),
    ]);

    expect(result.steps[1]?.boundaryReasons).toEqual(
      expect.arrayContaining(['idle_30s', 'cross_domain']),
    );
    expect(result.segments).toHaveLength(2);
    expect(result.segments[1]?.boundaryReason).toBe('idle_5m');
  });

  it('keeps cross-system work connected and links every task to steps', () => {
    const preprocessing = preprocessObservation([
      event(1),
      event(2, {
        actionType: 'domain_transition',
        hostname: 'erp.localhost',
      }),
      event(3, { hostname: 'erp.localhost' }),
    ]);
    const result = materializeInference(
      {
        tasks: [
          {
            apparentObjective: 'Validate invoice and vendor details',
            boundaryRationale: 'One continuous cross-system review.',
            confidence: 0.9,
            endStepOrdinal: 3,
            neutralLabel: 'Validate invoice',
            participatingSystems: ['ap.localhost', 'erp.localhost'],
            startStepOrdinal: 1,
          },
        ],
      },
      preprocessing,
      'openai/gpt-5-mini',
    );

    expect(result.tasks[0]?.participatingSystems).toEqual([
      'ap.localhost',
      'erp.localhost',
    ]);
    expect(result.tasks[0]?.supportingStepIds).toHaveLength(3);
  });

  it('rejects model tasks that cross a hard idle boundary', () => {
    const preprocessing = preprocessObservation([
      event(1),
      event(2, { occurredAt: '2026-08-12T10:06:00.000Z' }),
    ]);
    expect(() =>
      materializeInference(
        {
          tasks: [
            {
              apparentObjective: 'Invented long-running work',
              boundaryRationale: 'Invalidly crosses a hard boundary.',
              confidence: 0.2,
              endStepOrdinal: 2,
              neutralLabel: 'Invalid task',
              participatingSystems: ['ap.localhost'],
              startStepOrdinal: 1,
            },
          ],
        },
        preprocessing,
        'openai/gpt-5-mini',
      ),
    ).toThrow('task_crosses_hard_boundary');
  });
});

import { describe, expect, it } from 'vitest';

import type { RawEventForNormalization } from '@reflow/contracts';

import {
  applyBoundaryReconciliation,
  createInferenceBatches,
  materializeInference,
  preprocessObservation,
} from './pipeline';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const observationWindowId = '10000000-0000-4000-8000-000000000002';

function event(
  sequenceNo: number,
  overrides: Partial<RawEventForNormalization> = {},
): RawEventForNormalization {
  return {
    actionType: 'click',
    elementLabel: 'Open invoice',
    elementRole: 'button',
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
    expect(result.steps[0]?.interactionGroupId).not.toBe(
      result.steps[1]?.interactionGroupId,
    );
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
        excludedRanges: [],
        tasks: [
          {
            apparentObjective: 'Validate invoice and vendor details',
            boundaryConfidence: 0.9,
            boundaryRationale: 'One continuous cross-system review.',
            endStepOrdinal: 3,
            labelConfidence: 0.9,
            neutralLabel: 'Validate invoice',
            objectiveConfidence: 0.9,
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

  it('groups compound browser telemetry while retaining each source step', () => {
    const result = preprocessObservation([
      event(1, { elementRole: 'link' }),
      event(2, {
        actionType: 'domain_transition',
        hostname: 'erp.localhost',
      }),
      event(3, { actionType: 'navigate', hostname: 'erp.localhost' }),
    ]);
    expect(
      new Set(result.steps.map((step) => step.interactionGroupId)).size,
    ).toBe(1);
    expect(result.steps.flatMap((step) => step.sourceEventIds)).toHaveLength(3);
  });

  it('bounds an all-day segment and keeps five-minute gaps hard', () => {
    const continuous = Array.from({ length: 320 }, (_, index) =>
      event(index + 1, {
        actionType: index % 20 === 19 ? 'submit' : 'click',
        elementLabel: `Action ${index}`,
        elementRole: 'button',
      }),
    );
    const preprocessing = preprocessObservation([
      ...continuous,
      event(321, { occurredAt: '2026-08-12T11:00:00.000Z' }),
    ]);
    const batches = createInferenceBatches(preprocessing);
    expect(preprocessing.segments).toHaveLength(2);
    expect(batches.length).toBeGreaterThan(3);
    expect(
      batches.every(
        (batch) =>
          batch.assignableEndStepOrdinal -
            batch.assignableStartStepOrdinal +
            1 <=
          150,
      ),
    ).toBe(true);
    expect(batches.every((batch) => batch.steps.length <= 150 + 24)).toBe(true);
  });

  it('reconciles only candidates touching the selected batch seam', () => {
    const reconciled = applyBoundaryReconciliation(
      {
        excludedRanges: [],
        tasks: [
          {
            apparentObjective: 'Review invoice',
            boundaryConfidence: 0.7,
            boundaryRationale: 'Left batch.',
            endStepOrdinal: 10,
            labelConfidence: 0.8,
            neutralLabel: 'Review invoice',
            objectiveConfidence: 0.8,
            startStepOrdinal: 1,
          },
          {
            apparentObjective: 'Continue invoice review',
            boundaryConfidence: 0.7,
            boundaryRationale: 'Right batch.',
            endStepOrdinal: 20,
            labelConfidence: 0.8,
            neutralLabel: 'Continue invoice review',
            objectiveConfidence: 0.8,
            startStepOrdinal: 11,
          },
        ],
      },
      10,
      {
        apparentObjective: 'Validate the invoice across systems',
        boundaryConfidence: 0.9,
        decision: 'merge',
        labelConfidence: 0.9,
        neutralLabel: 'Validate invoice',
        objectiveConfidence: 0.9,
        rationale: 'The seam split one continuous objective.',
      },
    );
    expect(reconciled.tasks).toMatchObject([
      { endStepOrdinal: 20, startStepOrdinal: 1 },
    ]);
  });

  it('turns the demo trace into three business tasks and explicit context', () => {
    const descriptors: Array<Partial<RawEventForNormalization>> = [
      { actionType: 'page_context', elementLabel: null, elementRole: null },
      { actionType: 'navigate', elementLabel: null, elementRole: null },
      { elementLabel: 'Invoice inbox 4', elementRole: 'link' },
      { actionType: 'navigate', elementLabel: null, elementRole: null },
      { elementLabel: '[RECORD_ID]', elementRole: 'link' },
      { actionType: 'navigate', elementLabel: null, elementRole: null },
      { elementLabel: 'Cost center' },
      { actionType: 'input', elementLabel: 'Cost center' },
      { elementLabel: 'Cost center' },
      { elementLabel: 'Vendor email' },
      { actionType: 'input', elementLabel: 'Vendor email' },
      { actionType: 'input', elementLabel: 'Vendor phone' },
      { elementLabel: 'Validate invoice' },
      { actionType: 'hash_navigate', elementLabel: null, elementRole: null },
      { actionType: 'submit', elementLabel: 'Invoice review form' },
      { elementLabel: 'Open vendor in Atlas ERP', elementRole: 'link' },
      {
        actionType: 'domain_transition',
        hostname: 'erp.localhost',
        elementLabel: null,
        elementRole: null,
      },
      {
        actionType: 'navigate',
        hostname: 'erp.localhost',
        elementLabel: null,
        elementRole: null,
      },
      { hostname: 'erp.localhost', elementLabel: 'Tax identifier' },
      {
        actionType: 'input',
        hostname: 'erp.localhost',
        elementLabel: 'Tax identifier',
      },
      { hostname: 'erp.localhost', elementLabel: 'Remittance email' },
      { hostname: 'erp.localhost', elementLabel: 'Confirm vendor details' },
      {
        actionType: 'submit',
        hostname: 'erp.localhost',
        elementLabel: 'Vendor master review',
      },
      {
        hostname: 'erp.localhost',
        elementLabel: 'Open Clearline Payments',
        elementRole: 'link',
      },
      {
        actionType: 'domain_transition',
        hostname: 'bank.localhost',
        elementLabel: null,
        elementRole: null,
      },
      {
        actionType: 'navigate',
        hostname: 'bank.localhost',
        elementLabel: null,
        elementRole: null,
      },
      ...Array.from({ length: 7 }, (_, index) => ({
        actionType: index % 2 === 1 ? ('input' as const) : ('click' as const),
        elementLabel: 'Payment field',
        hostname: 'bank.localhost',
      })),
      { elementLabel: 'Submit for approval', hostname: 'bank.localhost' },
      {
        actionType: 'submit',
        elementLabel: 'Payment setup form',
        hostname: 'bank.localhost',
      },
      {
        actionType: 'spa_navigate',
        elementLabel: null,
        elementRole: null,
        hostname: 'bank.localhost',
      },
      {
        actionType: 'file_download',
        elementLabel: null,
        elementRole: null,
        hostname: 'bank.localhost',
      },
      {
        elementLabel: 'Return to Invoice Hub',
        elementRole: 'link',
        hostname: 'bank.localhost',
      },
      {
        actionType: 'domain_transition',
        hostname: 'ap.localhost',
        elementLabel: null,
        elementRole: null,
      },
      { actionType: 'navigate', elementLabel: null, elementRole: null },
    ];
    expect(descriptors).toHaveLength(40);
    const preprocessing = preprocessObservation(
      descriptors.map((descriptor, index) => event(index + 1, descriptor)),
    );
    const inference = {
      excludedRanges: [
        {
          classification: 'observation_context' as const,
          endStepOrdinal: 2,
          reason: 'Initial pages provide context only.',
          startStepOrdinal: 1,
        },
      ],
      tasks: [
        ['Review and validate invoice', 3, 15],
        ['Review and confirm vendor details', 16, 23],
        ['Prepare and submit payment', 24, 37],
        ['Return to invoice hub', 38, 40],
      ].map(([label, start, end]) => ({
        apparentObjective: String(label),
        boundaryConfidence: 0.9,
        boundaryRationale: 'Supported by the ordered browser evidence.',
        endStepOrdinal: Number(end),
        labelConfidence: 0.9,
        neutralLabel: String(label),
        objectiveConfidence: 0.9,
        startStepOrdinal: Number(start),
      })),
    };
    const result = materializeInference(
      inference,
      preprocessing,
      'openai/gpt-5-mini',
    );
    expect(
      result.tasks.map((task) => [task.startStepOrdinal, task.endStepOrdinal]),
    ).toEqual([
      [3, 15],
      [16, 23],
      [24, 40],
    ]);
    expect(result.exclusions).toMatchObject([
      {
        classification: 'observation_context',
        startStepOrdinal: 1,
        endStepOrdinal: 2,
      },
    ]);

    const renamed = materializeInference(
      {
        ...inference,
        tasks: inference.tasks.map((task) => ({
          ...task,
          neutralLabel: `Alternate ${task.neutralLabel}`,
        })),
      },
      preprocessing,
      'openai/gpt-5-mini',
    );
    expect(renamed.tasks.map((task) => task.clusterId)).toEqual(
      result.tasks.map((task) => task.clusterId),
    );
  });

  it('rejects model tasks that cross a hard idle boundary', () => {
    const preprocessing = preprocessObservation([
      event(1),
      event(2, { occurredAt: '2026-08-12T10:06:00.000Z' }),
    ]);
    expect(() =>
      materializeInference(
        {
          excludedRanges: [],
          tasks: [
            {
              apparentObjective: 'Invented long-running work',
              boundaryConfidence: 0.2,
              boundaryRationale: 'Invalidly crosses a hard boundary.',
              endStepOrdinal: 2,
              labelConfidence: 0.2,
              neutralLabel: 'Invalid task',
              objectiveConfidence: 0.2,
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

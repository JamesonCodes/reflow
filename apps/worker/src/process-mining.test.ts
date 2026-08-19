import { describe, expect, it } from 'vitest';

import type { MiningTask, ProcessBoundaryOutput } from '@reflow/contracts';

import {
  clusterEffectiveTasks,
  materializeProcessMining,
  validateProcessCoverage,
} from './process-mining';
import { stableUuid } from './pipeline';

const workspaceId = stableUuid('workspace');
const departmentId = stableUuid('department');

function task(
  window: string,
  ordinal: number,
  kind: 'invoice' | 'vendor' | 'payment',
  segment = 1,
  label: string = kind,
): MiningTask {
  const windowId = stableUuid(window);
  const systems =
    kind === 'invoice'
      ? ['ap.localhost']
      : kind === 'vendor'
        ? ['ap.localhost', 'erp.localhost']
        : ['erp.localhost', 'bank.localhost'];
  const start = new Date(Date.UTC(2026, 7, 19, 10, ordinal * 2));
  const end = new Date(start.getTime() + 45_000);
  return {
    apparentObjective: `Complete ${kind} work`,
    confidence: 0.9,
    department: 'Accounts Payable',
    departmentId,
    endedAt: end.toISOString(),
    endStepOrdinal: ordinal * 10,
    featureTokens: [
      `action:${kind === 'payment' ? 'submit' : 'input'}`,
      `path:/${kind}/:id`,
      `role:${kind === 'payment' ? 'button' : 'textbox'}`,
      `input:[${kind.toUpperCase()}]`,
    ],
    hardSegmentOrdinal: segment,
    id: stableUuid(`${window}:${ordinal}:${kind}`),
    neutralLabel: label,
    observationWindowId: windowId,
    ordinal,
    participatingSystems: systems,
    role: 'AP Specialist',
    sourceCorrectionId: null,
    sourceTaskInstanceIds: [stableUuid(`source:${window}:${ordinal}:${kind}`)],
    startedAt: start.toISOString(),
    startStepOrdinal: ordinal * 10 - 9,
    workspaceId,
  };
}

function output(start: number, end: number): ProcessBoundaryOutput {
  return {
    excludedRanges: [],
    processInstances: [
      {
        apparentOutcome: 'Invoice paid',
        boundaryRationale:
          'The sequence validates an invoice and submits its payment.',
        confidence: 0.9,
        endTaskOrdinal: end,
        neutralLabel: 'Invoice payment process',
        startTaskOrdinal: start,
      },
    ],
  };
}

describe('deterministic As-Is process mining', () => {
  it('forms one stable candidate from repeated traces and preserves exact variants', () => {
    const tasks = [
      task('window-a', 1, 'invoice'),
      task('window-a', 2, 'vendor'),
      task('window-a', 3, 'payment'),
      task('window-b', 1, 'invoice', 1, 'Different model wording'),
      task('window-b', 2, 'vendor'),
      task('window-b', 3, 'payment'),
      task('window-c', 1, 'invoice'),
      task('window-c', 2, 'vendor'),
      task('window-c', 3, 'payment'),
      task('window-c', 4, 'payment'),
    ];
    const outputs = new Map([
      [`${stableUuid('window-a')}:1`, output(1, 3)],
      [`${stableUuid('window-b')}:1`, output(1, 3)],
      [`${stableUuid('window-c')}:1`, output(1, 4)],
    ]);
    const result = materializeProcessMining(
      tasks,
      outputs,
      'openai/gpt-5-mini',
    );
    expect(result.instances).toHaveLength(3);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.metrics.observationCount).toBe(3);
    expect(result.candidates[0]?.variantCount).toBe(2);
    expect(result.candidates[0]?.canonicalClusterSequence).toHaveLength(4);
    expect(result.candidates[0]?.metrics.loopCount).toBe(1);
  });

  it('keeps cluster identity stable when model labels change', () => {
    const first = clusterEffectiveTasks([
      task('one', 1, 'invoice', 1, 'Review invoice'),
    ]);
    const second = clusterEffectiveTasks([
      task('two', 1, 'invoice', 1, 'Validate payable'),
    ]);
    expect(first[0]?.clusterKey).toBe(second[0]?.clusterKey);
  });

  it('does not promote a singleton process to a recurring candidate', () => {
    const tasks = [task('only', 1, 'invoice')];
    const result = materializeProcessMining(
      tasks,
      new Map([[`${stableUuid('only')}:1`, output(1, 1)]]),
      'openai/gpt-5-mini',
    );
    expect(result.instances).toHaveLength(1);
    expect(result.candidates).toHaveLength(0);
  });

  it('retains model-classified noise as unmatched evidence', () => {
    const tasks = [task('noise', 1, 'invoice')];
    const result = materializeProcessMining(
      tasks,
      new Map([
        [
          `${stableUuid('noise')}:1`,
          {
            excludedRanges: [
              {
                classification: 'noise',
                endTaskOrdinal: 1,
                reason: 'Insufficient evidence of a complete process outcome.',
                startTaskOrdinal: 1,
              },
            ],
            processInstances: [],
          },
        ],
      ]),
      'openai/gpt-5-mini',
    );
    expect(result.instances).toHaveLength(0);
    expect(result.candidates).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
  });

  it('supports back-to-back processes inside one hard segment', () => {
    const windowId = stableUuid('all-day');
    const tasks = [
      task('all-day', 1, 'invoice'),
      task('all-day', 2, 'payment'),
      task('all-day', 3, 'invoice'),
      task('all-day', 4, 'payment'),
    ];
    const result = materializeProcessMining(
      tasks,
      new Map([
        [
          `${windowId}:1`,
          {
            excludedRanges: [],
            processInstances: [
              output(1, 2).processInstances[0]!,
              output(3, 4).processInstances[0]!,
            ],
          },
        ],
      ]),
      'openai/gpt-5-mini',
    );
    expect(result.instances).toHaveLength(2);
    expect(result.candidates).toHaveLength(1);
  });

  it('cannot form one process across hard activity segments', () => {
    const tasks = [
      task('hard-gap', 1, 'invoice', 1),
      task('hard-gap', 2, 'payment', 2),
    ];
    expect(() =>
      materializeProcessMining(
        tasks,
        new Map([
          [`${stableUuid('hard-gap')}:1`, output(1, 2)],
          [`${stableUuid('hard-gap')}:2`, output(2, 2)],
        ]),
        'openai/gpt-5-mini',
      ),
    ).toThrow('invented_process_task');
  });

  it('requires exact, non-overlapping task coverage', () => {
    expect(() =>
      validateProcessCoverage(
        [task('bad', 1, 'invoice'), task('bad', 2, 'vendor')],
        output(1, 1),
      ),
    ).toThrow('incomplete_process_coverage');
  });
});

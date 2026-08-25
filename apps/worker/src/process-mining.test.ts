import { describe, expect, it } from 'vitest';

import type { MiningTask, ProcessCandidateLabel } from '@reflow/contracts';

import {
  clusterEffectiveTasks,
  finalizeProcessMining,
  prepareProcessMining,
} from './process-mining';
import { stableUuid } from './pipeline';

const workspaceId = stableUuid('workspace');
const departmentId = stableUuid('department');

const evidence = {
  invoice: [
    'system:ap.localhost',
    'path:/invoices/:id',
    'action:input',
    'role:textbox',
    'label:invoice amount',
    'input:[AMOUNT]',
    'system:ap.localhost',
    'action:submit',
  ],
  payment: [
    'system:erp.localhost',
    'path:/payments/new',
    'action:input',
    'input:[ACCOUNT]',
    'system:bank.localhost',
    'path:/payments/confirm',
    'action:submit',
    'action:file_download',
  ],
  vendor: [
    'system:ap.localhost',
    'path:/vendors/:id',
    'action:click',
    'system:erp.localhost',
    'path:/vendors/:id',
    'action:input',
    'input:[EMAIL]',
    'action:submit',
  ],
};

function task(
  window: string,
  ordinal: number,
  kind: keyof typeof evidence,
  options: {
    featureTokens?: string[];
    segment?: number;
    systems?: string[];
  } = {},
): MiningTask {
  const startedAt = new Date(Date.UTC(2026, 7, 19, 10, ordinal * 2));
  const endedAt = new Date(startedAt.getTime() + 45_000);
  return {
    apparentObjective: `Complete ${kind} work`,
    confidence: 0.9,
    department: 'Accounts Payable',
    departmentId,
    endedAt: endedAt.toISOString(),
    endStepOrdinal: ordinal * 10,
    featureTokens: options.featureTokens ?? evidence[kind],
    hardSegmentOrdinal: options.segment ?? 1,
    id: stableUuid(`${window}:${ordinal}:${kind}`),
    neutralLabel: kind,
    observationWindowId: stableUuid(window),
    ordinal,
    participatingSystems:
      options.systems ??
      (kind === 'invoice'
        ? ['ap.localhost']
        : kind === 'vendor'
          ? ['ap.localhost', 'erp.localhost']
          : ['erp.localhost', 'bank.localhost']),
    role: 'Invoice Specialist',
    sourceCorrectionId: null,
    sourceTaskInstanceIds: [stableUuid(`source:${window}:${ordinal}:${kind}`)],
    startedAt: startedAt.toISOString(),
    startStepOrdinal: ordinal * 10 - 9,
    workspaceId,
  };
}

const label: ProcessCandidateLabel = {
  apparentOutcome: 'Invoice reviewed and payment submitted',
  confidence: 0.92,
  evidenceRationale:
    'Both complete ranges move from invoice review through vendor confirmation to payment submission.',
  neutralLabel: 'Review invoice and submit payment',
};

function finalize(tasks: MiningTask[]) {
  const draft = prepareProcessMining(tasks, 'openai/gpt-5-mini');
  return {
    draft,
    result: finalizeProcessMining(
      draft,
      new Map(draft.candidates.map((candidate) => [candidate.id, label])),
    ),
  };
}

describe('split/merge-tolerant As-Is process mining', () => {
  it('turns the AP golden fixture into one complete process and one partial fragment', () => {
    const tasks = [
      task('full-three-tasks', 1, 'invoice'),
      task('full-three-tasks', 2, 'vendor'),
      task('full-three-tasks', 3, 'payment'),
      task('full-two-tasks', 1, 'invoice', {
        featureTokens: [...evidence.invoice, ...evidence.vendor],
        systems: ['ap.localhost', 'erp.localhost'],
      }),
      task('full-two-tasks', 2, 'payment', {
        featureTokens: [
          ...evidence.payment,
          'action:navigate',
          'system:ap.localhost',
          'path:/invoices/:id',
        ],
      }),
      task('partial', 1, 'invoice'),
    ];
    const { draft, result } = finalize(tasks);
    expect(draft.candidates).toHaveLength(1);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      neutralLabel: 'Review invoice and submit payment',
      participatingSystems: ['ap.localhost', 'erp.localhost', 'bank.localhost'],
      scope: 'primary',
      variantCount: 1,
    });
    expect(result.candidates[0]?.instanceIds).toHaveLength(2);
    expect(result.candidates[0]?.canonicalClusterSequence).toHaveLength(3);
    expect(
      result.instances.filter(
        (instance) => instance.disposition === 'complete_match',
      ),
    ).toHaveLength(2);
    expect(
      result.instances.filter(
        (instance) => instance.disposition === 'partial_fragment',
      ),
    ).toHaveLength(1);
    expect(
      new Set(result.instances.flatMap((instance) => instance.taskSnapshotIds))
        .size,
    ).toBe(6);
  });

  it('keeps cluster identity stable when model labels change', () => {
    const first = clusterEffectiveTasks([task('one', 1, 'invoice')]);
    const changed = task('two', 1, 'invoice');
    changed.neutralLabel = 'Different model wording';
    const second = clusterEffectiveTasks([changed]);
    expect(first[0]?.clusterKey).toBe(second[0]?.clusterKey);
  });

  it('does not promote a singleton process to a recurring candidate', () => {
    const { result } = finalize([task('only', 1, 'invoice')]);
    expect(result.candidates).toHaveLength(0);
    expect(result.instances[0]?.disposition).toBe('non_recurring');
  });

  it('supports repeated back-to-back processes inside an all-day segment', () => {
    const { result } = finalize([
      task('all-day', 1, 'invoice'),
      task('all-day', 2, 'payment'),
      task('all-day', 3, 'invoice'),
      task('all-day', 4, 'payment'),
    ]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.instanceIds).toHaveLength(2);
    expect(
      result.instances.every(
        (instance) => instance.taskSnapshotIds.length === 2,
      ),
    ).toBe(true);
  });

  it('never creates one instance across a five-minute hard segment boundary', () => {
    const { result } = finalize([
      task('hard-gap', 1, 'invoice', { segment: 1 }),
      task('hard-gap', 2, 'invoice', { segment: 2 }),
    ]);
    expect(result.candidates[0]?.instanceIds).toHaveLength(2);
    expect(
      result.instances.every(
        (instance) => instance.taskSnapshotIds.length === 1,
      ),
    ).toBe(true);
  });

  it('does not merge ranges with the same systems but different evidence', () => {
    const unrelated = task('unrelated', 1, 'invoice', {
      featureTokens: [
        'system:ap.localhost',
        'path:/employees/:id',
        'action:click',
        'label:terminate access',
        'action:submit',
      ],
    });
    const { result } = finalize([
      task('invoice-work', 1, 'invoice'),
      unrelated,
    ]);
    expect(result.candidates).toHaveLength(0);
    expect(
      result.instances.every(
        (instance) => instance.disposition === 'non_recurring',
      ),
    ).toBe(true);
  });
});

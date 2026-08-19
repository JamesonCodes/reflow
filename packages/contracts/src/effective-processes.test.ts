import { describe, expect, it } from 'vitest';

import { resolveEffectiveProcessCandidates } from './effective-processes';

const sources = [
  {
    apparentOutcome: 'Pay invoice',
    confidence: 0.9,
    id: 'candidate-a',
    instanceIds: ['instance-a', 'instance-b'],
    neutralLabel: 'Invoice payment',
    participatingSystems: ['ap.localhost'],
  },
  {
    apparentOutcome: 'Pay invoice variant',
    confidence: 0.8,
    id: 'candidate-b',
    instanceIds: ['instance-c', 'instance-d'],
    neutralLabel: 'Payment workflow',
    participatingSystems: ['bank.localhost'],
  },
];

describe('effective process candidate corrections', () => {
  it('renders merge and confirmation overlays without changing sources', () => {
    const result = resolveEffectiveProcessCandidates(sources, [
      {
        correctionType: 'merge',
        createdAt: '2026-08-19T10:00:00Z',
        id: 'merge',
        replacementLabels: ['Invoice-to-payment'],
        selectedProcessInstanceIds: [],
        sourceCandidateIds: ['candidate-a', 'candidate-b'],
      },
      {
        correctionType: 'confirm',
        createdAt: '2026-08-19T11:00:00Z',
        id: 'confirm',
        replacementLabels: [],
        selectedProcessInstanceIds: [],
        sourceCandidateIds: ['candidate-a', 'candidate-b'],
      },
    ]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      instanceIds: ['instance-a', 'instance-b', 'instance-c', 'instance-d'],
      neutralLabel: 'Invoice-to-payment',
      status: 'confirmed',
    });
    expect(sources[0]?.neutralLabel).toBe('Invoice payment');
  });

  it('splits instances into two effective candidates', () => {
    const result = resolveEffectiveProcessCandidates(
      [sources[0]!],
      [
        {
          correctionType: 'split',
          createdAt: '2026-08-19T10:00:00Z',
          id: 'split',
          replacementLabels: ['Standard', 'Exception'],
          selectedProcessInstanceIds: ['instance-b'],
          sourceCandidateIds: ['candidate-a'],
        },
      ],
    );
    expect(result.candidates.map((candidate) => candidate.instanceIds)).toEqual(
      [['instance-a'], ['instance-b']],
    );
  });
});

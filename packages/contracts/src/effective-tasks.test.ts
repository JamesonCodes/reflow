import { describe, expect, it } from 'vitest';

import {
  resolveEffectiveTasks,
  type EffectiveTaskSource,
} from './effective-tasks';

const sources: EffectiveTaskSource[] = [
  {
    apparentObjective: 'Review an invoice',
    confidence: 0.9,
    endStepOrdinal: 10,
    id: 'task-a',
    inferenceRunId: 'run-a',
    neutralLabel: 'Review invoice',
    participatingSystems: ['ap.localhost'],
    startStepOrdinal: 1,
  },
  {
    apparentObjective: 'Submit a payment',
    confidence: 0.8,
    endStepOrdinal: 20,
    id: 'task-b',
    inferenceRunId: 'run-a',
    neutralLabel: 'Submit payment',
    participatingSystems: ['bank.localhost'],
    startStepOrdinal: 11,
  },
];

describe('effective analyst task resolution', () => {
  it('applies a merge while retaining original source identities', () => {
    const result = resolveEffectiveTasks(sources, [
      {
        correctionType: 'merge',
        createdAt: '2026-08-13T10:00:00.000Z',
        id: 'correction-a',
        replacementLabels: ['Process invoice payment'],
        sourceTaskInstanceIds: ['task-a', 'task-b'],
        splitAfterStepOrdinal: null,
      },
    ]);
    expect(result.tasks).toMatchObject([
      {
        endStepOrdinal: 20,
        neutralLabel: 'Process invoice payment',
        sourceTaskInstanceIds: ['task-a', 'task-b'],
        startStepOrdinal: 1,
      },
    ]);
  });

  it('lets the newest overlapping correction supersede an older merge', () => {
    const result = resolveEffectiveTasks(sources, [
      {
        correctionType: 'merge',
        createdAt: '2026-08-13T10:00:00.000Z',
        id: 'correction-old',
        replacementLabels: ['Old merge'],
        sourceTaskInstanceIds: ['task-a', 'task-b'],
        splitAfterStepOrdinal: null,
      },
      {
        correctionType: 'rename',
        createdAt: '2026-08-13T11:00:00.000Z',
        id: 'correction-new',
        replacementLabels: ['Validate invoice'],
        sourceTaskInstanceIds: ['task-a'],
        splitAfterStepOrdinal: null,
      },
    ]);
    expect(result.tasks.map((task) => task.neutralLabel)).toEqual([
      'Validate invoice',
      'Submit payment',
    ]);
  });
});

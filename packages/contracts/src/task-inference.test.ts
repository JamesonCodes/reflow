import { describe, expect, it } from 'vitest';

import {
  taskCorrectionInputSchema,
  taskInferenceOutputSchema,
} from './task-inference';

describe('task inference contracts', () => {
  it('accepts bounded evidence-grounded task output', () => {
    expect(
      taskInferenceOutputSchema.safeParse({
        excludedRanges: [],
        tasks: [
          {
            apparentObjective: 'Validate an invoice and prepare payment',
            boundaryConfidence: 0.91,
            boundaryRationale: 'Steps share one invoice review objective.',
            endStepOrdinal: 12,
            labelConfidence: 0.91,
            neutralLabel: 'Review invoice',
            objectiveConfidence: 0.91,
            startStepOrdinal: 1,
          },
        ],
      }).success,
    ).toBe(true);
  });

  it('rejects malformed model output and correction shapes', () => {
    expect(
      taskInferenceOutputSchema.safeParse({
        tasks: [{ neutralLabel: 'Unbounded task' }],
      }).success,
    ).toBe(false);
    expect(
      taskCorrectionInputSchema.safeParse({
        correctionType: 'merge',
        reason: null,
        replacementLabels: ['Merged task'],
        splitAfterStepOrdinal: null,
        taskInstanceIds: ['10000000-0000-4000-8000-000000000001'],
        workspaceId: '10000000-0000-4000-8000-000000000002',
      }).success,
    ).toBe(false);
  });
});

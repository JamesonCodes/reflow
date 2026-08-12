import { describe, expect, it } from 'vitest';

import {
  taskCorrectionInputSchema,
  taskInferenceOutputSchema,
} from './task-inference';

describe('task inference contracts', () => {
  it('accepts bounded evidence-grounded task output', () => {
    expect(
      taskInferenceOutputSchema.safeParse({
        tasks: [
          {
            apparentObjective: 'Validate an invoice and prepare payment',
            boundaryRationale: 'Steps share one invoice review objective.',
            confidence: 0.91,
            endStepOrdinal: 12,
            neutralLabel: 'Review invoice',
            participatingSystems: ['ap.localhost', 'erp.localhost'],
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

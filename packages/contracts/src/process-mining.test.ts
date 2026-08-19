import { describe, expect, it } from 'vitest';

import { processCandidateCorrectionInputSchema } from './process-mining';

const shared = {
  miningRunId: '10000000-0000-4000-8000-000000000001',
  processCandidateIds: ['10000000-0000-4000-8000-000000000002'],
  reason: null,
  workspaceId: '10000000-0000-4000-8000-000000000003',
};

describe('process mining contracts', () => {
  it('accepts a split with bounded source instances', () => {
    expect(
      processCandidateCorrectionInputSchema.parse({
        ...shared,
        correctionType: 'split',
        replacementLabels: ['Standard', 'Exception'],
        selectedProcessInstanceIds: ['10000000-0000-4000-8000-000000000004'],
      }).correctionType,
    ).toBe('split');
  });

  it('rejects a merge without multiple candidates', () => {
    expect(
      processCandidateCorrectionInputSchema.safeParse({
        ...shared,
        correctionType: 'merge',
        replacementLabels: ['Merged'],
        selectedProcessInstanceIds: [],
      }).success,
    ).toBe(false);
  });
});

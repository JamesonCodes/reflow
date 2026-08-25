import { describe, expect, it, vi } from 'vitest';

import type { MiningTask } from '@reflow/contracts';

import { processMiningJob } from './process-mining-processor';
import { stableUuid } from './pipeline';
import type { ProcessingJob } from './repository';

const workspaceId = stableUuid('processor-workspace');
const departmentId = stableUuid('processor-department');

function miningTask(windowName: string): MiningTask {
  return {
    apparentObjective: 'Pay an invoice',
    confidence: 0.9,
    department: 'Accounts Payable',
    departmentId,
    endedAt: '2026-08-19T10:01:00.000Z',
    endStepOrdinal: 3,
    featureTokens: [
      'system:bank.localhost',
      'path:/payments/new',
      'action:submit',
    ],
    hardSegmentOrdinal: 1,
    id: stableUuid(`${windowName}:task`),
    neutralLabel: 'Pay invoice',
    observationWindowId: stableUuid(windowName),
    ordinal: 1,
    participatingSystems: ['bank.localhost'],
    role: 'Analyst',
    sourceCorrectionId: null,
    sourceTaskInstanceIds: [stableUuid(`${windowName}:source`)],
    startedAt: '2026-08-19T10:00:00.000Z',
    startStepOrdinal: 1,
    workspaceId,
  };
}

const job = {
  entity_id: departmentId,
  id: 1,
  job_type: 'process_mining',
  lock_token: stableUuid('process-lock'),
  workspace_id: workspaceId,
} as ProcessingJob;

describe('durable process mining processor', () => {
  it('labels deterministic evidence and persists once', async () => {
    const tasks = [miningTask('window-a'), miningTask('window-b')];
    const persist = vi.fn().mockResolvedValue(stableUuid('run'));
    const complete = vi.fn().mockResolvedValue(job);
    const label = vi.fn().mockResolvedValue({
      apparentOutcome: 'Invoice paid',
      confidence: 0.9,
      evidenceRationale: 'Two matching payment submissions were observed.',
      neutralLabel: 'Submit invoice payment',
    });
    const result = await processMiningJob(
      job,
      { apiKey: 'key', model: 'openai/gpt-5-mini' },
      {
        jobs: { complete },
        label,
        repository: {
          loadEffectiveTasks: vi.fn().mockResolvedValue({
            departmentId,
            tasks,
            workspaceId,
          }),
          miningExists: vi.fn().mockResolvedValue(false),
          persist,
        },
      },
    );
    expect(result.candidateCount).toBe(1);
    expect(label).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
  });

  it('leaves no partial persistence when Gateway labeling fails', async () => {
    const persist = vi.fn();
    await expect(
      processMiningJob(
        job,
        { apiKey: 'key', model: 'openai/gpt-5-mini' },
        {
          jobs: { complete: vi.fn() },
          label: vi.fn().mockRejectedValue(new Error('invalid label')),
          repository: {
            loadEffectiveTasks: vi.fn().mockResolvedValue({
              departmentId,
              tasks: [miningTask('window-a'), miningTask('window-b')],
              workspaceId,
            }),
            miningExists: vi.fn().mockResolvedValue(false),
            persist,
          },
        },
      ),
    ).rejects.toThrow('invalid label');
    expect(persist).not.toHaveBeenCalled();
  });
});

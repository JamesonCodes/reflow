import { describe, expect, it, vi } from 'vitest';

import type { MiningTask } from '@reflow/contracts';

import { processMiningJob } from './process-mining-processor';
import { stableUuid } from './pipeline';
import type { ProcessingJob } from './repository';

const workspaceId = stableUuid('processor-workspace');
const departmentId = stableUuid('processor-department');

function miningTask(windowName: string, ordinal: number): MiningTask {
  return {
    apparentObjective: 'Pay an invoice',
    confidence: 0.9,
    department: 'Accounts Payable',
    departmentId,
    endedAt: `2026-08-19T1${ordinal}:01:00.000Z`,
    endStepOrdinal: ordinal,
    featureTokens: ['action:submit', 'path:/payments/new'],
    hardSegmentOrdinal: 1,
    id: stableUuid(`${windowName}:task:${ordinal}`),
    neutralLabel: 'Pay invoice',
    observationWindowId: stableUuid(windowName),
    ordinal,
    participatingSystems: ['bank.localhost'],
    role: 'Analyst',
    sourceCorrectionId: null,
    sourceTaskInstanceIds: [stableUuid(`${windowName}:source:${ordinal}`)],
    startedAt: `2026-08-19T1${ordinal}:00:00.000Z`,
    startStepOrdinal: ordinal,
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
  it('persists once after every segment succeeds', async () => {
    const tasks = [miningTask('window-a', 1), miningTask('window-b', 1)];
    const persist = vi.fn().mockResolvedValue(stableUuid('run'));
    const complete = vi.fn().mockResolvedValue(job);
    const result = await processMiningJob(
      job,
      { apiKey: 'key', model: 'openai/gpt-5-mini' },
      {
        infer: vi.fn().mockResolvedValue({
          excludedRanges: [],
          processInstances: [
            {
              apparentOutcome: 'Invoice paid',
              boundaryRationale: 'One complete browser outcome.',
              confidence: 0.9,
              endTaskOrdinal: 1,
              neutralLabel: 'Invoice payment',
              startTaskOrdinal: 1,
            },
          ],
        }),
        jobs: { complete },
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
    expect(persist).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
  });

  it('leaves no partial persistence when a later segment is invalid', async () => {
    const tasks = [miningTask('window-a', 1), miningTask('window-b', 1)];
    const persist = vi.fn();
    let calls = 0;
    await expect(
      processMiningJob(
        job,
        { apiKey: 'key', model: 'openai/gpt-5-mini' },
        {
          infer: vi.fn().mockImplementation(() => {
            calls += 1;
            return Promise.resolve(
              calls === 1
                ? {
                    excludedRanges: [],
                    processInstances: [
                      {
                        apparentOutcome: 'Invoice paid',
                        boundaryRationale: 'Complete browser outcome.',
                        confidence: 0.9,
                        endTaskOrdinal: 1,
                        neutralLabel: 'Invoice payment',
                        startTaskOrdinal: 1,
                      },
                    ],
                  }
                : { excludedRanges: [], processInstances: [] },
            );
          }),
          jobs: { complete: vi.fn() },
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
      ),
    ).rejects.toThrow('incomplete_process_coverage');
    expect(persist).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';

import type { inferBrowserTasks, reconcileTaskBoundary } from '@reflow/ai';
import type {
  RawEventForNormalization,
  TaskInferenceOutput,
} from '@reflow/contracts';

import { processTaskInferenceJob } from './processor';
import type { ProcessingJob } from './repository';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const windowId = '10000000-0000-4000-8000-000000000002';

const job: ProcessingJob = {
  attempt_count: 1,
  available_at: '2026-08-12T10:00:00.000Z',
  created_at: '2026-08-12T10:00:00.000Z',
  entity_id: windowId,
  error_code: null,
  error_detail: null,
  id: 42,
  job_type: 'task_inference',
  lock_token: '10000000-0000-4000-8000-000000000003',
  locked_at: '2026-08-12T10:00:00.000Z',
  locked_by: 'test-worker',
  max_attempts: 5,
  status: 'running',
  updated_at: '2026-08-12T10:00:00.000Z',
  workspace_id: workspaceId,
};

const events: RawEventForNormalization[] = [
  {
    actionType: 'click',
    elementLabel: 'Review invoice',
    elementRole: 'button',
    hostname: 'ap.localhost',
    id: '10000000-0000-4000-8000-000000000004',
    normalizedPath: '/invoices',
    observationWindowId: windowId,
    occurredAt: '2026-08-12T10:00:01.000Z',
    pageLandmark: 'Invoice queue',
    semanticInputToken: null,
    sequenceNo: 1,
    tabId: 1,
    workspaceId,
  },
];

const output: TaskInferenceOutput = {
  excludedRanges: [],
  tasks: [
    {
      apparentObjective: 'Review an invoice',
      boundaryConfidence: 0.8,
      boundaryRationale: 'The single observed action starts this task.',
      endStepOrdinal: 1,
      labelConfidence: 0.8,
      neutralLabel: 'Review invoice',
      objectiveConfidence: 0.8,
      startStepOrdinal: 1,
    },
  ],
};

function repository(existing = false) {
  return {
    complete: vi.fn().mockResolvedValue(job),
    inferenceExists: vi.fn().mockResolvedValue(existing),
    loadObservation: vi.fn().mockResolvedValue({
      context: { department: 'Accounts payable', role: 'Analyst', workspaceId },
      events,
    }),
    persistInference: vi.fn().mockResolvedValue({ id: 'run' }),
  };
}

describe('task inference processor', () => {
  it('persists evidence-backed inference before completing the job', async () => {
    const store = repository();
    const infer = vi.fn<typeof inferBrowserTasks>().mockResolvedValue(output);
    const result = await processTaskInferenceJob(
      job,
      { apiKey: 'gateway-key', model: 'openai/gpt-5-mini' },
      { infer, repository: store },
    );

    expect(result.skipped).toBe(false);
    expect(store.persistInference).toHaveBeenCalledOnce();
    expect(store.complete).toHaveBeenCalledOnce();
    expect(infer).toHaveBeenCalledOnce();
    expect(infer.mock.calls[0]?.[1].department).toBe('Accounts payable');
    expect(infer.mock.calls[0]?.[1].steps).toHaveLength(1);
  });

  it('completes a restarted job without calling the model twice', async () => {
    const store = repository(true);
    const infer = vi.fn<typeof inferBrowserTasks>();
    const result = await processTaskInferenceJob(
      job,
      { apiKey: 'gateway-key', model: 'openai/gpt-5-mini' },
      { infer, repository: store },
    );

    expect(result.skipped).toBe(true);
    expect(infer).not.toHaveBeenCalled();
    expect(store.persistInference).not.toHaveBeenCalled();
    expect(store.complete).toHaveBeenCalledOnce();
  });

  it('does not persist or complete invalid model output', async () => {
    const store = repository();
    const infer = vi
      .fn<typeof inferBrowserTasks>()
      .mockRejectedValue(new Error('invalid_task_inference_output'));

    await expect(
      processTaskInferenceJob(
        job,
        { apiKey: 'gateway-key', model: 'openai/gpt-5-mini' },
        { infer, repository: store },
      ),
    ).rejects.toThrow('invalid_task_inference_output');
    expect(store.persistInference).not.toHaveBeenCalled();
    expect(store.complete).not.toHaveBeenCalled();
  });

  it('infers a long completed observation in bounded sequential batches', async () => {
    const store = repository();
    store.loadObservation.mockResolvedValue({
      context: { department: 'Accounts payable', role: 'Analyst', workspaceId },
      events: Array.from({ length: 310 }, (_, index) => ({
        ...events[0]!,
        actionType:
          index % 50 === 49 ? ('submit' as const) : ('click' as const),
        elementLabel: `Action ${index}`,
        id: `10000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
        occurredAt: new Date(
          Date.parse('2026-08-12T10:00:00.000Z') + index * 2_000,
        ).toISOString(),
        sequenceNo: index + 1,
      })),
    });
    const infer = vi
      .fn<typeof inferBrowserTasks>()
      .mockImplementation((_configuration, request) =>
        Promise.resolve({
          excludedRanges: [],
          tasks: [
            {
              apparentObjective: 'Complete one bounded work episode',
              boundaryConfidence: 0.8,
              boundaryRationale: 'The assignable batch is one fixture task.',
              endStepOrdinal: request.assignableEndStepOrdinal!,
              labelConfidence: 0.8,
              neutralLabel: 'Complete work episode',
              objectiveConfidence: 0.8,
              startStepOrdinal: request.assignableStartStepOrdinal!,
            },
          ],
        }),
      );
    const reconcile = vi.fn<typeof reconcileTaskBoundary>().mockResolvedValue({
      apparentObjective: null,
      boundaryConfidence: 0.9,
      decision: 'keep_separate',
      labelConfidence: 0.9,
      neutralLabel: null,
      objectiveConfidence: 0.9,
      rationale: 'Each batch represents a separate repeated task.',
    });

    await processTaskInferenceJob(
      job,
      { apiKey: 'gateway-key', model: 'openai/gpt-5-mini' },
      { infer, reconcile, repository: store },
    );

    expect(infer).toHaveBeenCalledTimes(3);
    expect(reconcile).toHaveBeenCalledTimes(2);
    const persisted = store.persistInference.mock.calls[0]?.[0] as {
      tasks: unknown[];
    };
    expect(persisted.tasks).toHaveLength(3);
  });
});

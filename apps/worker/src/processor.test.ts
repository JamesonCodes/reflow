import { describe, expect, it, vi } from 'vitest';

import type { inferBrowserTasks } from '@reflow/ai';
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
  tasks: [
    {
      apparentObjective: 'Review an invoice',
      boundaryRationale: 'The single observed action starts this task.',
      confidence: 0.8,
      endStepOrdinal: 1,
      neutralLabel: 'Review invoice',
      participatingSystems: ['ap.localhost'],
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
});

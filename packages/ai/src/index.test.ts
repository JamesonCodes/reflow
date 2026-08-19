import { describe, expect, it } from 'vitest';

import type { MiningTask, NormalizedStep } from '@reflow/contracts';

import {
  inferBrowserTasks,
  inferProcessBoundaries,
  reconcileTaskBoundary,
} from './index';

const configuration = {
  apiKey: 'test-gateway-key',
  model: 'openai/gpt-5-mini',
};

const step: NormalizedStep = {
  actionType: 'click',
  boundaryReasons: [],
  candidateBoundaryBefore: false,
  elementLabel: 'Open invoice',
  elementRole: 'link',
  endedAt: '2026-08-12T10:00:00.000Z',
  hostname: 'ap.localhost',
  id: '10000000-0000-4000-8000-000000000001',
  interactionGroupId: '10000000-0000-4000-8000-000000000005',
  normalizedPath: '/inbox',
  observationWindowId: '10000000-0000-4000-8000-000000000002',
  ordinal: 1,
  pageLandmark: 'Invoice queue',
  semanticInputToken: null,
  sourceEventIds: ['10000000-0000-4000-8000-000000000003'],
  startedAt: '2026-08-12T10:00:00.000Z',
  stepKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  tabId: 1,
  workspaceId: '10000000-0000-4000-8000-000000000004',
};

describe('Vercel AI Gateway task inference adapter', () => {
  it('accepts schema-valid mocked structured output', async () => {
    await expect(
      inferBrowserTasks(
        configuration,
        {
          department: 'Accounts Payable',
          role: 'Invoice analyst',
          steps: [step],
        },
        (_config, prompt) => {
          expect(prompt).not.toContain('rawValue');
          expect(prompt).toContain('business activity or outcome');
          return Promise.resolve({
            excludedRanges: [],
            tasks: [
              {
                apparentObjective: 'Begin reviewing an invoice',
                boundaryConfidence: 0.86,
                boundaryRationale: 'The observer opened an invoice record.',
                endStepOrdinal: 1,
                labelConfidence: 0.86,
                neutralLabel: 'Open invoice for review',
                objectiveConfidence: 0.86,
                startStepOrdinal: 1,
              },
            ],
          });
        },
      ),
    ).resolves.toMatchObject({ tasks: [{ startStepOrdinal: 1 }] });
  });

  it('rejects invalid mocked output before persistence', async () => {
    await expect(
      inferBrowserTasks(
        configuration,
        { department: 'Finance', role: null, steps: [step] },
        () => Promise.resolve({ tasks: [{ label: 'missing evidence' }] }),
      ),
    ).rejects.toThrow('invalid_task_inference_output');
  });

  it('validates structured boundary reconciliation through the same gateway', async () => {
    const task = {
      apparentObjective: 'Review an invoice',
      boundaryConfidence: 0.8,
      boundaryRationale: 'Batch evidence.',
      endStepOrdinal: 1,
      labelConfidence: 0.8,
      neutralLabel: 'Review invoice',
      objectiveConfidence: 0.8,
      startStepOrdinal: 1,
    };
    await expect(
      reconcileTaskBoundary(
        configuration,
        {
          department: 'Finance',
          leftTask: task,
          rightTask: { ...task, endStepOrdinal: 2, startStepOrdinal: 2 },
          role: 'Analyst',
          seamStepOrdinal: 1,
          steps: [step],
        },
        () =>
          Promise.resolve({
            apparentObjective: 'Review an invoice',
            boundaryConfidence: 0.9,
            decision: 'merge',
            labelConfidence: 0.9,
            neutralLabel: 'Review invoice',
            objectiveConfidence: 0.9,
            rationale: 'One continuous evidence-backed objective.',
          }),
      ),
    ).resolves.toMatchObject({ decision: 'merge' });
  });
});

describe('Vercel AI Gateway process mining adapter', () => {
  it('validates complete process boundary output', async () => {
    const task: MiningTask = {
      apparentObjective: 'Validate an invoice',
      confidence: 0.9,
      department: 'Accounts Payable',
      departmentId: '10000000-0000-4000-8000-000000000010',
      endedAt: '2026-08-12T10:01:00.000Z',
      endStepOrdinal: 5,
      featureTokens: ['action:submit'],
      hardSegmentOrdinal: 1,
      id: '10000000-0000-4000-8000-000000000011',
      neutralLabel: 'Validate invoice',
      observationWindowId: '10000000-0000-4000-8000-000000000012',
      ordinal: 1,
      participatingSystems: ['ap.localhost'],
      role: 'Analyst',
      sourceCorrectionId: null,
      sourceTaskInstanceIds: ['10000000-0000-4000-8000-000000000013'],
      startedAt: '2026-08-12T10:00:00.000Z',
      startStepOrdinal: 1,
      workspaceId: '10000000-0000-4000-8000-000000000014',
    };
    await expect(
      inferProcessBoundaries(
        configuration,
        { department: task.department, role: task.role, tasks: [task] },
        (_config, prompt) => {
          expect(prompt).toContain('back-to-back processes');
          return Promise.resolve({
            excludedRanges: [
              {
                classification: 'standalone_work',
                endTaskOrdinal: 1,
                reason: 'Only one process-shaped task was observed.',
                startTaskOrdinal: 1,
              },
            ],
            processInstances: [],
          });
        },
      ),
    ).resolves.toMatchObject({ excludedRanges: [{ startTaskOrdinal: 1 }] });
  });
});

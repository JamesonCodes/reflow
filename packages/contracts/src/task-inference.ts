import { z } from 'zod';

import {
  capturedActionTypeSchema,
  capturedHostnameSchema,
  normalizedBrowserPathSchema,
  semanticInputTokenSchema,
} from './observation';

const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const normalizationVersion = 1 as const;
export const taskInferencePromptVersion = 1 as const;

export const rawEventForNormalizationSchema = z.strictObject({
  id: z.uuid(),
  observationWindowId: z.uuid(),
  workspaceId: z.uuid(),
  sequenceNo: z.number().int().positive(),
  actionType: capturedActionTypeSchema,
  hostname: capturedHostnameSchema.nullable(),
  normalizedPath: normalizedBrowserPathSchema.nullable(),
  elementRole: boundedText(64).nullable(),
  elementLabel: boundedText(160).nullable(),
  pageLandmark: boundedText(160).nullable(),
  semanticInputToken: semanticInputTokenSchema.nullable(),
  tabId: z.number().int().positive(),
  occurredAt: z.iso.datetime({ offset: true }),
});

export const normalizedStepSchema = z.strictObject({
  id: z.uuid(),
  observationWindowId: z.uuid(),
  workspaceId: z.uuid(),
  ordinal: z.number().int().positive(),
  stepKey: z.string().regex(/^[a-f0-9]{64}$/),
  actionType: capturedActionTypeSchema,
  hostname: capturedHostnameSchema.nullable(),
  normalizedPath: normalizedBrowserPathSchema.nullable(),
  elementRole: boundedText(64).nullable(),
  elementLabel: boundedText(160).nullable(),
  pageLandmark: boundedText(160).nullable(),
  semanticInputToken: semanticInputTokenSchema.nullable(),
  tabId: z.number().int().positive(),
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }),
  sourceEventIds: z.array(z.uuid()).min(1),
  candidateBoundaryBefore: z.boolean(),
  boundaryReasons: z.array(
    z.enum([
      'idle_30s',
      'idle_5m',
      'major_navigation',
      'tab_change',
      'cross_domain',
      'out_of_scope_gap',
    ]),
  ),
});

export const activitySegmentSchema = z.strictObject({
  id: z.uuid(),
  observationWindowId: z.uuid(),
  workspaceId: z.uuid(),
  ordinal: z.number().int().positive(),
  startStepOrdinal: z.number().int().positive(),
  endStepOrdinal: z.number().int().positive(),
  boundaryReason: z.enum(['observation_start', 'idle_5m']),
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }),
});

export const taskInferenceTaskSchema = z.strictObject({
  neutralLabel: boundedText(120),
  apparentObjective: boundedText(300),
  startStepOrdinal: z.number().int().positive(),
  endStepOrdinal: z.number().int().positive(),
  participatingSystems: z.array(capturedHostnameSchema).min(1).max(20),
  confidence: z.number().min(0).max(1),
  boundaryRationale: boundedText(500),
});

export const taskInferenceOutputSchema = z.strictObject({
  tasks: z.array(taskInferenceTaskSchema).max(100),
});

export const inferredTaskInstanceSchema = taskInferenceTaskSchema.extend({
  id: z.uuid(),
  ordinal: z.number().int().positive(),
  supportingStepIds: z.array(z.uuid()).min(1),
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }),
  clusterId: z.uuid(),
  clusterKey: z.string().regex(/^[a-f0-9]{64}$/),
});

export const taskCorrectionTypeSchema = z.enum([
  'rename',
  'merge',
  'split',
  'reject',
]);

export const taskCorrectionInputSchema = z
  .strictObject({
    workspaceId: z.uuid(),
    correctionType: taskCorrectionTypeSchema,
    taskInstanceIds: z.array(z.uuid()).min(1).max(20),
    replacementLabels: z.array(boundedText(120)).max(2),
    splitAfterStepOrdinal: z.number().int().positive().nullable(),
    reason: boundedText(500).nullable(),
  })
  .superRefine((correction, context) => {
    const sources = correction.taskInstanceIds.length;
    const labels = correction.replacementLabels.length;
    const split = correction.splitAfterStepOrdinal;
    const valid =
      (correction.correctionType === 'rename' &&
        sources === 1 &&
        labels === 1 &&
        split === null) ||
      (correction.correctionType === 'merge' &&
        sources >= 2 &&
        labels === 1 &&
        split === null) ||
      (correction.correctionType === 'split' &&
        sources === 1 &&
        labels === 2 &&
        split !== null) ||
      (correction.correctionType === 'reject' &&
        sources === 1 &&
        labels === 0 &&
        split === null);
    if (!valid)
      context.addIssue({
        code: 'custom',
        message: 'Correction fields do not match the selected operation',
      });
  });

export type RawEventForNormalization = z.infer<
  typeof rawEventForNormalizationSchema
>;
export type NormalizedStep = z.infer<typeof normalizedStepSchema>;
export type ActivitySegment = z.infer<typeof activitySegmentSchema>;
export type TaskInferenceOutput = z.infer<typeof taskInferenceOutputSchema>;
export type InferredTaskInstance = z.infer<typeof inferredTaskInstanceSchema>;
export type TaskCorrectionInput = z.infer<typeof taskCorrectionInputSchema>;

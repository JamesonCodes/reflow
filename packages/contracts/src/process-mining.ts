import { z } from 'zod';

import { capturedHostnameSchema } from './observation';

const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const processMiningAlgorithmVersion = 2 as const;
export const processMiningPromptVersion = 2 as const;

export const miningTaskSchema = z.strictObject({
  id: z.uuid(),
  workspaceId: z.uuid(),
  observationWindowId: z.uuid(),
  departmentId: z.uuid(),
  department: boundedText(120),
  role: boundedText(120).nullable(),
  ordinal: z.number().int().positive(),
  hardSegmentOrdinal: z.number().int().positive(),
  neutralLabel: boundedText(120),
  apparentObjective: boundedText(300),
  participatingSystems: z.array(capturedHostnameSchema).min(1).max(20),
  startStepOrdinal: z.number().int().positive(),
  endStepOrdinal: z.number().int().positive(),
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }),
  confidence: z.number().min(0).max(1),
  featureTokens: z.array(boundedText(600)).min(1).max(500),
  sourceTaskInstanceIds: z.array(z.uuid()).min(1).max(20),
  sourceCorrectionId: z.uuid().nullable(),
});

export const processBoundaryInstanceSchema = z.strictObject({
  startTaskOrdinal: z.number().int().positive(),
  endTaskOrdinal: z.number().int().positive(),
  neutralLabel: boundedText(140),
  apparentOutcome: boundedText(400),
  confidence: z.number().min(0).max(1),
  boundaryRationale: boundedText(500),
});

export const processBoundaryExclusionSchema = z.strictObject({
  startTaskOrdinal: z.number().int().positive(),
  endTaskOrdinal: z.number().int().positive(),
  classification: z.enum(['standalone_work', 'noise', 'uncertain']),
  reason: boundedText(500),
});

export const processBoundaryOutputSchema = z.strictObject({
  processInstances: z.array(processBoundaryInstanceSchema).max(200),
  excludedRanges: z.array(processBoundaryExclusionSchema).max(200),
});

export const processInstanceDispositionSchema = z.enum([
  'complete_match',
  'partial_fragment',
  'non_recurring',
  'uncertain',
  'legacy_unclassified',
]);

export const processMatchDiagnosticsSchema = z.strictObject({
  actionScore: z.number().min(0).max(1),
  completionCompatible: z.boolean(),
  compositeScore: z.number().min(0).max(1),
  containmentScore: z.number().min(0).max(1),
  inputScore: z.number().min(0).max(1),
  labelScore: z.number().min(0).max(1),
  pathScore: z.number().min(0).max(1),
  systemSequenceScore: z.number().min(0).max(1),
});

export const processVariantSchema = z.strictObject({
  canonicalClusterSequence: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
  instanceIds: z.array(z.uuid()).min(1),
  representativeInstanceId: z.uuid(),
  variantKey: z.string().regex(/^[a-f0-9]{64}$/),
});

export const processCandidateLabelSchema = z.strictObject({
  apparentOutcome: boundedText(400),
  confidence: z.number().min(0).max(1),
  evidenceRationale: boundedText(500),
  neutralLabel: boundedText(140),
});

export const processMetricsSchema = z.strictObject({
  instanceCount: z.number().int().positive(),
  observationCount: z.number().int().positive(),
  medianDurationSeconds: z.number().nonnegative(),
  p90DurationSeconds: z.number().nonnegative(),
  medianTaskCount: z.number().nonnegative(),
  taskFrequency: z.record(z.string(), z.number().int().positive()),
  roleFrequency: z.record(z.string(), z.number().int().positive()),
  departmentFrequency: z.record(z.string(), z.number().int().positive()),
  systemFrequency: z.record(z.string(), z.number().int().positive()),
  loopCount: z.number().int().nonnegative(),
  backtrackCount: z.number().int().nonnegative(),
  crossSystemTransitionCount: z.number().int().nonnegative(),
  possibleRepeatedEntryCount: z.number().int().nonnegative(),
  longWaitCount: z.number().int().nonnegative(),
  possibleAbandonmentCount: z.number().int().nonnegative(),
  navigationChurnRatio: z.number().min(0).max(1),
});

export const processGraphEdgeSchema = z.strictObject({
  sourceClusterKey: z.string().regex(/^[a-f0-9]{64}$/),
  targetClusterKey: z.string().regex(/^[a-f0-9]{64}$/),
  occurrenceCount: z.number().int().positive(),
  medianTransitionSeconds: z.number().nonnegative(),
});

export const processFindingSchema = z.strictObject({
  id: z.uuid(),
  findingType: z.enum([
    'loop',
    'backtracking',
    'repeated_entry',
    'navigation_churn',
    'long_wait',
    'possible_abandonment',
    'role_difference',
  ]),
  severity: z.enum(['low', 'medium', 'high']),
  summary: boundedText(300),
  evidenceTaskSnapshotIds: z.array(z.uuid()).min(1),
  evidenceObservationWindowIds: z.array(z.uuid()).min(1),
});

export const processCandidateSchema = z.strictObject({
  id: z.uuid(),
  candidateKey: z.string().regex(/^[a-f0-9]{64}$/),
  neutralLabel: boundedText(140),
  apparentOutcome: boundedText(400),
  evidenceRationale: boundedText(500),
  confidence: z.number().min(0).max(1),
  scope: z.literal('primary'),
  participatingSystems: z.array(capturedHostnameSchema).min(1).max(20),
  instanceIds: z.array(z.uuid()).min(2),
  canonicalClusterSequence: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
  variantCount: z.number().int().positive(),
  variants: z.array(processVariantSchema).min(1),
  metrics: processMetricsSchema,
  graphEdges: z.array(processGraphEdgeSchema),
  findings: z.array(processFindingSchema),
});

export const processCandidateCorrectionTypeSchema = z.enum([
  'rename',
  'merge',
  'split',
  'reject',
  'confirm',
]);

export const processCandidateCorrectionInputSchema = z
  .strictObject({
    workspaceId: z.uuid(),
    miningRunId: z.uuid(),
    correctionType: processCandidateCorrectionTypeSchema,
    processCandidateIds: z.array(z.uuid()).min(1).max(20),
    selectedProcessInstanceIds: z.array(z.uuid()).max(1000),
    replacementLabels: z.array(boundedText(140)).max(2),
    reason: boundedText(500).nullable(),
  })
  .superRefine((correction, context) => {
    const candidateCount = correction.processCandidateIds.length;
    const labelCount = correction.replacementLabels.length;
    const selectedCount = correction.selectedProcessInstanceIds.length;
    const valid =
      (correction.correctionType === 'rename' &&
        candidateCount >= 1 &&
        labelCount === 1 &&
        selectedCount === 0) ||
      (correction.correctionType === 'merge' &&
        candidateCount >= 2 &&
        labelCount === 1 &&
        selectedCount === 0) ||
      (correction.correctionType === 'split' &&
        candidateCount >= 1 &&
        labelCount === 2 &&
        selectedCount > 0) ||
      ((correction.correctionType === 'reject' ||
        correction.correctionType === 'confirm') &&
        candidateCount >= 1 &&
        labelCount === 0 &&
        selectedCount === 0);
    if (!valid)
      context.addIssue({
        code: 'custom',
        message: 'Correction fields do not match the selected operation',
      });
  });

export type MiningTask = z.infer<typeof miningTaskSchema>;
export type ProcessBoundaryOutput = z.infer<typeof processBoundaryOutputSchema>;
export type ProcessCandidate = z.infer<typeof processCandidateSchema>;
export type ProcessCandidateLabel = z.infer<typeof processCandidateLabelSchema>;
export type ProcessFinding = z.infer<typeof processFindingSchema>;
export type ProcessInstanceDisposition = z.infer<
  typeof processInstanceDispositionSchema
>;
export type ProcessMatchDiagnostics = z.infer<
  typeof processMatchDiagnosticsSchema
>;
export type ProcessCandidateCorrectionInput = z.infer<
  typeof processCandidateCorrectionInputSchema
>;

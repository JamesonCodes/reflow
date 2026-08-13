import { createHash } from 'node:crypto';

import {
  activitySegmentSchema,
  inferredTaskInstanceSchema,
  materializedTaskExclusionSchema,
  normalizationVersion,
  normalizedStepSchema,
  taskInferencePromptVersion,
  type ActivitySegment,
  type InferredTaskInstance,
  type MaterializedTaskExclusion,
  type NormalizedStep,
  type RawEventForNormalization,
  type TaskBoundaryReconciliation,
  type TaskInferenceOutput,
} from '@reflow/contracts';

const collapseWindowMilliseconds = 1_000;
const interactionWindowMilliseconds = 2_000;
const candidateIdleMilliseconds = 30_000;
const hardIdleMilliseconds = 5 * 60_000;
export const maximumBatchSteps = 150;
export const batchContextSteps = 12;

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function stableUuid(value: string) {
  const bytes = hash(value).slice(0, 32).split('');
  bytes[12] = '5';
  const variant = Number.parseInt(bytes[16]!, 16);
  bytes[16] = ((variant & 0x3) | 0x8).toString(16);
  const joined = bytes.join('');
  return [
    joined.slice(0, 8),
    joined.slice(8, 12),
    joined.slice(12, 16),
    joined.slice(16, 20),
    joined.slice(20),
  ].join('-');
}

function actionSignature(event: RawEventForNormalization) {
  return JSON.stringify([
    event.actionType,
    event.hostname,
    event.normalizedPath,
    event.elementRole,
    event.elementLabel,
    event.pageLandmark,
    event.semanticInputToken,
    event.tabId,
  ]);
}

function stepKey(event: RawEventForNormalization) {
  return hash(actionSignature(event));
}

function elapsedMilliseconds(before: string, after: string) {
  return new Date(after).getTime() - new Date(before).getTime();
}

function laterTimestamp(first: string, second: string) {
  return new Date(first).getTime() >= new Date(second).getTime()
    ? first
    : second;
}

function boundaryReasons(
  previous: NormalizedStep | undefined,
  current: RawEventForNormalization,
) {
  if (!previous) return [];
  const reasons: NormalizedStep['boundaryReasons'] = [];
  const idle = elapsedMilliseconds(previous.endedAt, current.occurredAt);
  if (idle >= hardIdleMilliseconds) reasons.push('idle_5m');
  else if (idle >= candidateIdleMilliseconds) reasons.push('idle_30s');
  if (
    ['navigate', 'spa_navigate', 'hash_navigate'].includes(current.actionType)
  )
    reasons.push('major_navigation');
  if (previous.tabId !== current.tabId) reasons.push('tab_change');
  if (
    previous.hostname !== null &&
    current.hostname !== null &&
    previous.hostname !== current.hostname
  )
    reasons.push('cross_domain');
  if (
    previous.actionType === 'out_of_scope_gap' ||
    current.actionType === 'out_of_scope_gap'
  )
    reasons.push('out_of_scope_gap');
  return [...new Set(reasons)];
}

const compoundActions = new Set([
  'click',
  'submit',
  'domain_transition',
  'navigate',
  'spa_navigate',
  'hash_navigate',
]);

function continuesInteractionGroup(
  previous: NormalizedStep | undefined,
  current: RawEventForNormalization,
) {
  if (!previous) return false;
  const elapsed = elapsedMilliseconds(previous.endedAt, current.occurredAt);
  return (
    elapsed >= 0 &&
    elapsed <= interactionWindowMilliseconds &&
    compoundActions.has(previous.actionType) &&
    compoundActions.has(current.actionType) &&
    current.actionType !== 'click'
  );
}

export interface PreprocessedObservation {
  digest: string;
  segments: ActivitySegment[];
  steps: NormalizedStep[];
}

export interface InferenceBatch {
  assignableEndStepOrdinal: number;
  assignableStartStepOrdinal: number;
  hardSegmentOrdinal: number;
  id: string;
  seamAfterStepOrdinal: number | null;
  steps: NormalizedStep[];
}

export function preprocessObservation(
  sourceEvents: RawEventForNormalization[],
): PreprocessedObservation {
  if (sourceEvents.length === 0)
    return { digest: hash('[]'), segments: [], steps: [] };

  const events = [...sourceEvents].sort(
    (left, right) => left.sequenceNo - right.sequenceNo,
  );
  const first = events[0]!;
  const seenSequences = new Set<number>();
  for (const event of events) {
    if (
      event.workspaceId !== first.workspaceId ||
      event.observationWindowId !== first.observationWindowId
    )
      throw new Error('mixed_observation_events');
    if (seenSequences.has(event.sequenceNo))
      throw new Error('duplicate_event_sequence');
    seenSequences.add(event.sequenceNo);
  }

  const steps: NormalizedStep[] = [];
  let interactionOrdinal = 0;
  for (const event of events) {
    const previous = steps.at(-1);
    const withinCollapseWindow =
      previous &&
      elapsedMilliseconds(previous.endedAt, event.occurredAt) >= 0 &&
      elapsedMilliseconds(previous.endedAt, event.occurredAt) <=
        collapseWindowMilliseconds;
    if (
      previous &&
      previous.stepKey === stepKey(event) &&
      withinCollapseWindow
    ) {
      previous.endedAt = laterTimestamp(previous.endedAt, event.occurredAt);
      previous.sourceEventIds.push(event.id);
      continue;
    }

    if (!continuesInteractionGroup(previous, event)) interactionOrdinal += 1;
    const ordinal = steps.length + 1;
    const reasons = boundaryReasons(previous, event);
    steps.push(
      normalizedStepSchema.parse({
        actionType: event.actionType,
        boundaryReasons: reasons,
        candidateBoundaryBefore: reasons.length > 0,
        elementLabel: event.elementLabel,
        elementRole: event.elementRole,
        endedAt: event.occurredAt,
        hostname: event.hostname,
        id: stableUuid(
          `${event.observationWindowId}:normalized:${normalizationVersion}:${ordinal}`,
        ),
        interactionGroupId: stableUuid(
          `${event.observationWindowId}:interaction:${normalizationVersion}:${interactionOrdinal}`,
        ),
        normalizedPath: event.normalizedPath,
        observationWindowId: event.observationWindowId,
        ordinal,
        pageLandmark: event.pageLandmark,
        semanticInputToken: event.semanticInputToken,
        sourceEventIds: [event.id],
        startedAt: event.occurredAt,
        stepKey: stepKey(event),
        tabId: event.tabId,
        workspaceId: event.workspaceId,
      }),
    );
  }

  const segments: ActivitySegment[] = [];
  let segmentStart = 0;
  for (let index = 1; index <= steps.length; index += 1) {
    const isEnd = index === steps.length;
    const startsAfterHardIdle =
      !isEnd && steps[index]!.boundaryReasons.includes('idle_5m');
    if (!isEnd && !startsAfterHardIdle) continue;

    const start = steps[segmentStart]!;
    const end = steps[index - 1]!;
    const ordinal = segments.length + 1;
    segments.push(
      activitySegmentSchema.parse({
        boundaryReason:
          ordinal === 1 ? 'observation_start' : ('idle_5m' as const),
        endStepOrdinal: end.ordinal,
        endedAt: end.endedAt,
        id: stableUuid(
          `${first.observationWindowId}:segment:${normalizationVersion}:${ordinal}`,
        ),
        observationWindowId: first.observationWindowId,
        ordinal,
        startedAt: start.startedAt,
        startStepOrdinal: start.ordinal,
        workspaceId: first.workspaceId,
      }),
    );
    segmentStart = index;
  }

  const digest = hash(
    JSON.stringify(
      steps.map((step) => [
        step.workspaceId,
        step.observationWindowId,
        step.ordinal,
        step.stepKey,
        step.actionType,
        step.hostname,
        step.normalizedPath,
        step.elementRole,
        step.elementLabel,
        step.pageLandmark,
        step.semanticInputToken,
        step.tabId,
        step.startedAt,
        step.endedAt,
        step.interactionGroupId,
        step.candidateBoundaryBefore,
        step.boundaryReasons,
      ]),
    ),
  );
  return { digest, segments, steps };
}

function preferredSeamEnd(
  steps: NormalizedStep[],
  start: number,
  maximum: number,
) {
  const minimumCandidate = start + Math.floor(maximumBatchSteps / 2);
  const candidates = steps.filter((step) => {
    if (step.ordinal < minimumCandidate || step.ordinal > maximum) return false;
    const next = steps[step.ordinal];
    return (
      ['submit', 'file_download'].includes(step.actionType) ||
      next?.boundaryReasons.includes('idle_30s') === true
    );
  });
  return candidates.at(-1)?.ordinal ?? maximum;
}

export function createInferenceBatches(
  preprocessing: PreprocessedObservation,
): InferenceBatch[] {
  const batches: InferenceBatch[] = [];
  for (const segment of preprocessing.segments) {
    let start = segment.startStepOrdinal;
    while (start <= segment.endStepOrdinal) {
      const maximum = Math.min(
        segment.endStepOrdinal,
        start + maximumBatchSteps - 1,
      );
      const end =
        maximum === segment.endStepOrdinal
          ? maximum
          : preferredSeamEnd(preprocessing.steps, start, maximum);
      const contextStart = Math.max(
        segment.startStepOrdinal,
        start - batchContextSteps,
      );
      const contextEnd = Math.min(
        segment.endStepOrdinal,
        end + batchContextSteps,
      );
      batches.push({
        assignableEndStepOrdinal: end,
        assignableStartStepOrdinal: start,
        hardSegmentOrdinal: segment.ordinal,
        id: stableUuid(
          `${segment.id}:batch:${start}:${end}:${normalizationVersion}`,
        ),
        seamAfterStepOrdinal: end < segment.endStepOrdinal ? end : null,
        steps: preprocessing.steps.slice(contextStart - 1, contextEnd),
      });
      start = end + 1;
    }
  }
  return batches;
}

export function combineBatchOutputs(outputs: TaskInferenceOutput[]) {
  return outputs.reduce<TaskInferenceOutput>(
    (combined, output) => ({
      excludedRanges: [...combined.excludedRanges, ...output.excludedRanges],
      tasks: [...combined.tasks, ...output.tasks],
    }),
    { excludedRanges: [], tasks: [] },
  );
}

export function applyBoundaryReconciliation(
  output: TaskInferenceOutput,
  seamStepOrdinal: number,
  reconciliation: TaskBoundaryReconciliation,
) {
  const leftIndex = output.tasks.findIndex(
    (task) => task.endStepOrdinal === seamStepOrdinal,
  );
  const rightIndex = output.tasks.findIndex(
    (task) => task.startStepOrdinal === seamStepOrdinal + 1,
  );
  if (leftIndex < 0 || rightIndex < 0 || leftIndex === rightIndex)
    return output;
  if (reconciliation.decision === 'keep_separate') return output;

  const left = output.tasks[leftIndex]!;
  const right = output.tasks[rightIndex]!;
  const merged = {
    apparentObjective: reconciliation.apparentObjective!,
    boundaryConfidence: reconciliation.boundaryConfidence,
    boundaryRationale: reconciliation.rationale,
    endStepOrdinal: right.endStepOrdinal,
    labelConfidence: reconciliation.labelConfidence,
    neutralLabel: reconciliation.neutralLabel!,
    objectiveConfidence: reconciliation.objectiveConfidence,
    startStepOrdinal: left.startStepOrdinal,
  };
  return {
    ...output,
    tasks: output.tasks
      .filter((_, index) => index !== leftIndex && index !== rightIndex)
      .concat(merged),
  };
}

export function markBoundaryUncertain(
  output: TaskInferenceOutput,
  seamStepOrdinal: number,
) {
  return {
    ...output,
    tasks: output.tasks.map((task) =>
      task.startStepOrdinal === seamStepOrdinal + 1
        ? {
            ...task,
            boundaryConfidence: Math.min(task.boundaryConfidence, 0.5),
            boundaryRationale:
              `${task.boundaryRationale} Batch seam reconciliation was unavailable.`.slice(
                0,
                500,
              ),
          }
        : task,
    ),
  };
}

function normalizedEvidenceLabel(label: string | null) {
  return (
    label
      ?.toLowerCase()
      .replace(/\[[a-z0-9_:-]+\]/g, ':token')
      .replace(/\d+/g, ':number')
      .replace(/\s+/g, ' ')
      .trim() ?? null
  );
}

function evidenceClusterKey(steps: NormalizedStep[]) {
  return hash(
    JSON.stringify(
      steps.map((step) => [
        step.actionType,
        step.hostname,
        step.normalizedPath,
        step.elementRole,
        normalizedEvidenceLabel(step.elementLabel),
        step.semanticInputToken,
      ]),
    ),
  );
}

function isTransportOnly(steps: NormalizedStep[]) {
  return steps.every(
    (step) =>
      [
        'page_context',
        'navigate',
        'spa_navigate',
        'hash_navigate',
        'tab_activate',
        'domain_transition',
        'out_of_scope_gap',
      ].includes(step.actionType) ||
      (step.actionType === 'click' && step.elementRole === 'link'),
  );
}

export interface MaterializedInference {
  exclusions: MaterializedTaskExclusion[];
  runId: string;
  tasks: InferredTaskInstance[];
}

export function materializeInference(
  output: TaskInferenceOutput,
  preprocessing: PreprocessedObservation,
  model: string,
): MaterializedInference {
  if (preprocessing.steps.length === 0)
    return {
      exclusions: [],
      runId: stableUuid(
        `empty:${preprocessing.digest}:${model}:${taskInferencePromptVersion}`,
      ),
      tasks: [],
    };

  const first = preprocessing.steps[0]!;
  const runId = stableUuid(
    `${first.observationWindowId}:${preprocessing.digest}:${model}:${taskInferencePromptVersion}:${normalizationVersion}`,
  );
  const dispositions = [
    ...output.tasks.map((value) => ({
      end: value.endStepOrdinal,
      kind: 'task' as const,
      start: value.startStepOrdinal,
      value,
    })),
    ...output.excludedRanges.map((value) => ({
      end: value.endStepOrdinal,
      kind: 'exclusion' as const,
      start: value.startStepOrdinal,
      value,
    })),
  ].sort((left, right) => left.start - right.start || left.end - right.end);

  let expectedStart = 1;
  for (const disposition of dispositions) {
    if (
      disposition.start !== expectedStart ||
      disposition.end < disposition.start ||
      disposition.end > preprocessing.steps.length
    )
      throw new Error('inference_step_coverage_invalid');
    expectedStart = disposition.end + 1;
  }
  if (expectedStart !== preprocessing.steps.length + 1)
    throw new Error('inference_step_coverage_invalid');

  const hardStarts = new Set(
    preprocessing.segments.slice(1).map((segment) => segment.startStepOrdinal),
  );
  const workingTasks: TaskInferenceOutput['tasks'] = [];
  const workingExclusions: TaskInferenceOutput['excludedRanges'] = [];

  for (const disposition of dispositions) {
    const supportingSteps = preprocessing.steps.slice(
      disposition.start - 1,
      disposition.end,
    );
    if (disposition.kind === 'task') {
      for (
        let ordinal = disposition.start + 1;
        ordinal <= disposition.end;
        ordinal += 1
      )
        if (hardStarts.has(ordinal))
          throw new Error('task_crosses_hard_boundary');
    }

    const transport =
      isTransportOnly(supportingSteps) ||
      (disposition.kind === 'exclusion' &&
        disposition.value.classification === 'transport_only');
    const previousTask = workingTasks.at(-1);
    if (
      transport &&
      previousTask &&
      previousTask.endStepOrdinal === disposition.start - 1 &&
      !hardStarts.has(disposition.start)
    ) {
      previousTask.endStepOrdinal = disposition.end;
      continue;
    }
    if (transport && disposition.kind === 'task') {
      workingExclusions.push({
        classification:
          workingTasks.length === 0 ? 'observation_context' : 'transport_only',
        endStepOrdinal: disposition.end,
        reason:
          workingTasks.length === 0
            ? 'Initial browser context does not represent user work.'
            : 'Browser transport without a substantive business interaction.',
        startStepOrdinal: disposition.start,
      });
      continue;
    }
    if (disposition.kind === 'task')
      workingTasks.push({ ...disposition.value });
    else workingExclusions.push(disposition.value);
  }

  const tasks = workingTasks.map((task, index) => {
    const supportingSteps = preprocessing.steps.slice(
      task.startStepOrdinal - 1,
      task.endStepOrdinal,
    );
    const systems = [
      ...new Set(
        supportingSteps
          .map((step) => step.hostname)
          .filter((hostname): hostname is string => hostname !== null),
      ),
    ].sort();
    if (systems.length === 0) throw new Error('task_requires_approved_system');
    const clusterKey = evidenceClusterKey(supportingSteps);
    const ordinal = index + 1;
    return inferredTaskInstanceSchema.parse({
      ...task,
      clusterId: stableUuid(`${first.workspaceId}:cluster:${clusterKey}`),
      clusterKey,
      confidence: Math.min(
        task.boundaryConfidence,
        task.labelConfidence,
        task.objectiveConfidence,
      ),
      endedAt: supportingSteps.at(-1)!.endedAt,
      id: stableUuid(`${runId}:task:${ordinal}`),
      ordinal,
      participatingSystems: systems,
      startedAt: supportingSteps[0]!.startedAt,
      supportingStepIds: supportingSteps.map((step) => step.id),
    });
  });

  const exclusions = workingExclusions.map((exclusion, index) => {
    const supportingSteps = preprocessing.steps.slice(
      exclusion.startStepOrdinal - 1,
      exclusion.endStepOrdinal,
    );
    return materializedTaskExclusionSchema.parse({
      ...exclusion,
      id: stableUuid(`${runId}:exclusion:${index + 1}`),
      ordinal: index + 1,
      supportingStepIds: supportingSteps.map((step) => step.id),
    });
  });

  return { exclusions, runId, tasks };
}

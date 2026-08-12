import { createHash } from 'node:crypto';

import {
  activitySegmentSchema,
  inferredTaskInstanceSchema,
  normalizationVersion,
  normalizedStepSchema,
  taskInferencePromptVersion,
  type ActivitySegment,
  type InferredTaskInstance,
  type NormalizedStep,
  type RawEventForNormalization,
  type TaskInferenceOutput,
} from '@reflow/contracts';

const collapseWindowMilliseconds = 1_000;
const candidateIdleMilliseconds = 30_000;
const hardIdleMilliseconds = 5 * 60_000;

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

export interface PreprocessedObservation {
  digest: string;
  segments: ActivitySegment[];
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
    const endIndex = startsAfterHardIdle ? index - 1 : index - 1;
    const end = steps[endIndex]!;
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
        step.candidateBoundaryBefore,
        step.boundaryReasons,
      ]),
    ),
  );
  return { digest, segments, steps };
}

export interface MaterializedInference {
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
      runId: stableUuid(
        `empty:${preprocessing.digest}:${model}:${taskInferencePromptVersion}`,
      ),
      tasks: [],
    };

  const first = preprocessing.steps[0]!;
  const runId = stableUuid(
    `${first.observationWindowId}:${preprocessing.digest}:${model}:${taskInferencePromptVersion}:${normalizationVersion}`,
  );
  const ordered = [...output.tasks].sort(
    (left, right) => left.startStepOrdinal - right.startStepOrdinal,
  );
  let previousEnd = 0;
  const hardStarts = new Set(
    preprocessing.segments.slice(1).map((segment) => segment.startStepOrdinal),
  );

  const tasks = ordered.map((task, index) => {
    if (
      task.startStepOrdinal <= previousEnd ||
      task.endStepOrdinal < task.startStepOrdinal ||
      task.endStepOrdinal > preprocessing.steps.length
    )
      throw new Error('invalid_task_step_range');
    for (
      let ordinal = task.startStepOrdinal + 1;
      ordinal <= task.endStepOrdinal;
      ordinal += 1
    ) {
      if (hardStarts.has(ordinal))
        throw new Error('task_crosses_hard_boundary');
    }
    previousEnd = task.endStepOrdinal;

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

    const clusterKey = hash(
      JSON.stringify([task.neutralLabel.trim().toLowerCase(), systems]),
    );
    const ordinal = index + 1;
    return inferredTaskInstanceSchema.parse({
      ...task,
      clusterId: stableUuid(`${first.workspaceId}:cluster:${clusterKey}`),
      clusterKey,
      endStepOrdinal: task.endStepOrdinal,
      endedAt: supportingSteps.at(-1)!.endedAt,
      id: stableUuid(`${runId}:task:${ordinal}`),
      ordinal,
      participatingSystems: systems,
      startStepOrdinal: task.startStepOrdinal,
      startedAt: supportingSteps[0]!.startedAt,
      supportingStepIds: supportingSteps.map((step) => step.id),
    });
  });

  return { runId, tasks };
}

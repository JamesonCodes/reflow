import { createHash } from 'node:crypto';

import {
  processCandidateSchema,
  processMiningAlgorithmVersion,
  type MiningTask,
  type ProcessCandidate,
  type ProcessCandidateLabel,
  type ProcessFinding,
  type ProcessInstanceDisposition,
  type ProcessMatchDiagnostics,
} from '@reflow/contracts';

import { stableUuid } from './pipeline';

const maximumRangeTasks = 20;
const completeMatchThreshold = 0.75;
const completeSystemThreshold = 0.8;
const partialContainmentThreshold = 0.7;
const sameVariantThreshold = 0.88;

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function secondsBetween(before: string, after: string) {
  return Math.max(0, (Date.parse(after) - Date.parse(before)) / 1000);
}

function percentile(values: number[], quantile: number) {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const index = (ordered.length - 1) * quantile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return ordered[lower]!;
  return (
    ordered[lower]! + (ordered[upper]! - ordered[lower]!) * (index - lower)
  );
}

function frequency(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function jaccard(left: string[], right: string[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((value) => rightSet.has(value));
  const union = new Set([...leftSet, ...rightSet]);
  return union.size === 0 ? 1 : intersection.length / union.size;
}

function containment(subset: string[], superset: string[]) {
  const subsetSet = new Set(subset);
  if (subsetSet.size === 0) return 1;
  const supersetSet = new Set(superset);
  return (
    [...subsetSet].filter((value) => supersetSet.has(value)).length /
    subsetSet.size
  );
}

function lcsLength(left: string[], right: string[]) {
  const matrix = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0),
  );
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      matrix[leftIndex]![rightIndex] =
        left[leftIndex - 1] === right[rightIndex - 1]
          ? matrix[leftIndex - 1]![rightIndex - 1]! + 1
          : Math.max(
              matrix[leftIndex - 1]![rightIndex]!,
              matrix[leftIndex]![rightIndex - 1]!,
            );
    }
  }
  return matrix[left.length]![right.length]!;
}

function lcsRatio(left: string[], right: string[]) {
  return lcsLength(left, right) / Math.max(left.length, right.length, 1);
}

function sequenceContainment(subset: string[], superset: string[]) {
  return lcsLength(subset, superset) / Math.max(subset.length, 1);
}

function collapseConsecutive(values: string[]) {
  return values.filter((value, index) => values[index - 1] !== value);
}

function groupBy<T>(values: T[], keyFor: (value: T) => string) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

function uniqueFamily(tokens: string[], family: string) {
  return [
    ...new Set(tokens.filter((token) => token.startsWith(`${family}:`))),
  ].sort();
}

export interface ProcessRangeFingerprint {
  actions: string[];
  inputs: string[];
  labels: string[];
  paths: string[];
  systems: string[];
  terminalActions: string[];
}

export interface ProcessRange {
  endIndex: number;
  fingerprint: ProcessRangeFingerprint;
  fingerprintHash: string;
  hardSegmentOrdinal: number;
  id: string;
  observationWindowId: string;
  startIndex: number;
  tasks: ProcessTaskSnapshot[];
}

export interface ProcessTaskSnapshot extends MiningTask {
  clusterKey: string;
  featureSignature: string;
}

export interface MaterializedProcessInstance {
  apparentOutcome: string;
  boundaryRationale: string;
  clusterSequence: string[];
  confidence: number;
  department: string;
  disposition: ProcessInstanceDisposition;
  durationSeconds: number;
  endedAt: string;
  id: string;
  matchDiagnostics: ProcessMatchDiagnostics;
  neutralLabel: string;
  observationWindowId: string;
  rangeFingerprint: string;
  relatedCandidateKey: string | null;
  role: string | null;
  startedAt: string;
  taskSnapshotIds: string[];
}

export interface UnmatchedProcessWork {
  classification: 'standalone_work' | 'noise' | 'uncertain';
  observationWindowId: string;
  reason: string;
  taskSnapshotIds: string[];
}

export interface ProcessCandidateDraft {
  candidateKey: string;
  completeRanges: ProcessRange[];
  id: string;
  representativeRange: ProcessRange;
}

export interface ProcessMiningDraft {
  candidates: ProcessCandidateDraft[];
  digest: string;
  runId: string;
  snapshots: ProcessTaskSnapshot[];
}

export interface ProcessMiningResult {
  candidates: ProcessCandidate[];
  digest: string;
  instances: MaterializedProcessInstance[];
  runId: string;
  snapshots: ProcessTaskSnapshot[];
  unmatched: UnmatchedProcessWork[];
}

function fingerprintForTasks(tasks: ProcessTaskSnapshot[]) {
  const tokens = tasks.flatMap((task) => task.featureTokens);
  const finalTokens = tasks.at(-1)?.featureTokens ?? [];
  const lastCompletionIndex = tokens.reduce(
    (latest, token, index) =>
      ['action:file_download', 'action:submit'].includes(token)
        ? index
        : latest,
    -1,
  );
  const businessTokens =
    lastCompletionIndex >= 0
      ? tokens.slice(0, lastCompletionIndex + 1)
      : tokens;
  const systems = collapseConsecutive(
    businessTokens
      .filter((token) => token.startsWith('system:'))
      .map((token) => token.slice('system:'.length)),
  );
  const fingerprint: ProcessRangeFingerprint = {
    actions: uniqueFamily(businessTokens, 'action'),
    inputs: uniqueFamily(businessTokens, 'input'),
    labels: uniqueFamily(businessTokens, 'label'),
    paths: uniqueFamily(businessTokens, 'path'),
    systems,
    terminalActions: uniqueFamily(finalTokens, 'action').filter((token) =>
      ['action:file_download', 'action:submit'].includes(token),
    ),
  };
  return {
    fingerprint,
    fingerprintHash: hash(JSON.stringify(fingerprint)),
  };
}

function completionCompatible(
  left: ProcessRangeFingerprint,
  right: ProcessRangeFingerprint,
) {
  if (
    left.terminalActions.some((action) =>
      right.terminalActions.includes(action),
    )
  )
    return true;
  return (
    left.systems.at(-1) === right.systems.at(-1) &&
    jaccard(left.paths, right.paths) >= 0.8
  );
}

function scoreFingerprints(
  left: ProcessRangeFingerprint,
  right: ProcessRangeFingerprint,
): ProcessMatchDiagnostics {
  const actionScore = jaccard(left.actions, right.actions);
  const inputScore = jaccard(left.inputs, right.inputs);
  const labelScore = jaccard(left.labels, right.labels);
  const pathScore = jaccard(left.paths, right.paths);
  const systemSequenceScore = lcsRatio(left.systems, right.systems);
  const leftContainsRight =
    sequenceContainment(right.systems, left.systems) * 0.3 +
    containment(right.paths, left.paths) * 0.25 +
    containment(right.actions, left.actions) * 0.2 +
    containment(right.inputs, left.inputs) * 0.15 +
    containment(right.labels, left.labels) * 0.1;
  const rightContainsLeft =
    sequenceContainment(left.systems, right.systems) * 0.3 +
    containment(left.paths, right.paths) * 0.25 +
    containment(left.actions, right.actions) * 0.2 +
    containment(left.inputs, right.inputs) * 0.15 +
    containment(left.labels, right.labels) * 0.1;
  return {
    actionScore,
    completionCompatible: completionCompatible(left, right),
    compositeScore:
      systemSequenceScore * 0.3 +
      pathScore * 0.25 +
      actionScore * 0.2 +
      inputScore * 0.15 +
      labelScore * 0.1,
    containmentScore: Math.max(leftContainsRight, rightContainsLeft),
    inputScore,
    labelScore,
    pathScore,
    systemSequenceScore,
  };
}

function completeRangeMatch(left: ProcessRange, right: ProcessRange) {
  const score = scoreFingerprints(left.fingerprint, right.fingerprint);
  return (
    score.compositeScore >= completeMatchThreshold &&
    score.systemSequenceScore >= completeSystemThreshold &&
    score.completionCompatible
  );
}

function rangesOverlap(left: ProcessRange, right: ProcessRange) {
  return (
    left.observationWindowId === right.observationWindowId &&
    left.hardSegmentOrdinal === right.hardSegmentOrdinal &&
    left.startIndex <= right.endIndex &&
    right.startIndex <= left.endIndex
  );
}

function createRange(
  tasks: ProcessTaskSnapshot[],
  startIndex: number,
  endIndex: number,
) {
  const rangeTasks = tasks.slice(startIndex, endIndex + 1);
  const { fingerprint, fingerprintHash } = fingerprintForTasks(rangeTasks);
  const first = rangeTasks[0]!;
  return {
    endIndex,
    fingerprint,
    fingerprintHash,
    hardSegmentOrdinal: first.hardSegmentOrdinal,
    id: stableUuid(
      `process-range:${rangeTasks.map((task) => task.id).join(':')}`,
    ),
    observationWindowId: first.observationWindowId,
    startIndex,
    tasks: rangeTasks,
  } satisfies ProcessRange;
}

function enumerateRanges(snapshots: ProcessTaskSnapshot[]) {
  const ranges: ProcessRange[] = [];
  for (const segmentTasks of groupBy(
    snapshots,
    (task) => `${task.observationWindowId}:${task.hardSegmentOrdinal}`,
  ).values()) {
    const ordered = [...segmentTasks].sort(
      (left, right) => left.ordinal - right.ordinal,
    );
    for (let start = 0; start < ordered.length; start += 1) {
      const maximumEnd = Math.min(
        ordered.length - 1,
        start + maximumRangeTasks - 1,
      );
      for (let end = start; end <= maximumEnd; end += 1)
        ranges.push(createRange(ordered, start, end));
    }
  }
  return ranges;
}

function candidateBreadth(ranges: ProcessRange[]) {
  const minimumSystems = Math.min(
    ...ranges.map((range) => new Set(range.fingerprint.systems).size),
  );
  const minimumPaths = Math.min(
    ...ranges.map((range) => range.fingerprint.paths.length),
  );
  const minimumActions = Math.min(
    ...ranges.map((range) => range.fingerprint.actions.length),
  );
  const minimumTasks = Math.min(...ranges.map((range) => range.tasks.length));
  return (
    minimumSystems * 1_000_000 +
    minimumPaths * 10_000 +
    minimumActions * 100 +
    minimumTasks
  );
}

function discoverRecurringRangeGroups(ranges: ProcessRange[]) {
  const compatiblePairs: Array<[ProcessRange, ProcessRange]> = [];
  for (let leftIndex = 0; leftIndex < ranges.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < ranges.length;
      rightIndex += 1
    ) {
      const left = ranges[leftIndex]!;
      const right = ranges[rightIndex]!;
      if (rangesOverlap(left, right)) continue;
      if (completeRangeMatch(left, right)) compatiblePairs.push([left, right]);
    }
  }
  compatiblePairs.sort(
    (left, right) =>
      candidateBreadth(right) - candidateBreadth(left) ||
      right[0].tasks.length +
        right[1].tasks.length -
        left[0].tasks.length -
        left[1].tasks.length ||
      left[0].id.localeCompare(right[0].id),
  );
  const groups = new Map<string, ProcessRange[]>();
  for (const pair of compatiblePairs) {
    const group = [...pair];
    for (const range of ranges) {
      if (group.some((member) => member.id === range.id)) continue;
      if (group.some((member) => rangesOverlap(member, range))) continue;
      if (group.every((member) => completeRangeMatch(member, range)))
        group.push(range);
    }
    const unique = [
      ...new Map(group.map((range) => [range.id, range])).values(),
    ].sort((left, right) => left.id.localeCompare(right.id));
    const key = unique.map((range) => range.id).join(':');
    groups.set(key, unique);
  }
  return [...groups.values()].sort(
    (left, right) =>
      candidateBreadth(right) - candidateBreadth(left) ||
      right.length - left.length ||
      left[0]!.id.localeCompare(right[0]!.id),
  );
}

function selectPrimaryRangeGroups(groups: ProcessRange[][]) {
  const selected: ProcessRange[][] = [];
  const selectedRanges: ProcessRange[] = [];
  for (const group of groups) {
    if (
      group.some((range) =>
        selectedRanges.some((used) => rangesOverlap(range, used)),
      )
    )
      continue;
    selected.push(group);
    selectedRanges.push(...group);
  }
  return selected;
}

function chooseRepresentative(ranges: ProcessRange[]) {
  return [...ranges].sort(
    (left, right) =>
      right.fingerprint.systems.length - left.fingerprint.systems.length ||
      right.tasks.length - left.tasks.length ||
      right.fingerprint.paths.length - left.fingerprint.paths.length ||
      left.id.localeCompare(right.id),
  )[0]!;
}

function clusterTaskCompatibility(left: MiningTask, right: MiningTask) {
  if (
    left.participatingSystems.join('|') !== right.participatingSystems.join('|')
  )
    return false;
  return (
    jaccard(left.featureTokens, right.featureTokens) >= 0.8 &&
    lcsRatio(left.featureTokens, right.featureTokens) >= 0.7
  );
}

export function clusterEffectiveTasks(tasks: MiningTask[]) {
  const ordered = [...tasks].sort(
    (left, right) =>
      hash(JSON.stringify(left.featureTokens)).localeCompare(
        hash(JSON.stringify(right.featureTokens)),
      ) || left.id.localeCompare(right.id),
  );
  const groups: MiningTask[][] = [];
  for (const task of ordered) {
    const group = groups.find((candidate) =>
      candidate.every((member) => clusterTaskCompatibility(member, task)),
    );
    if (group) group.push(task);
    else groups.push([task]);
  }
  const clusterByTaskId = new Map<string, string>();
  for (const group of groups) {
    const signatures = group
      .map((task) => hash(JSON.stringify(task.featureTokens)))
      .sort();
    const clusterKey = hash(JSON.stringify([...new Set(signatures)]));
    for (const task of group) clusterByTaskId.set(task.id, clusterKey);
  }
  return tasks.map((task) => ({
    ...task,
    clusterKey: clusterByTaskId.get(task.id)!,
    featureSignature: hash(JSON.stringify(task.featureTokens)),
  }));
}

export function prepareProcessMining(
  tasks: MiningTask[],
  model: string,
): ProcessMiningDraft {
  const clustered = clusterEffectiveTasks(tasks);
  const digest = hash(
    JSON.stringify({
      algorithmVersion: processMiningAlgorithmVersion,
      model,
      tasks: clustered.map((task) => [
        task.id,
        task.featureSignature,
        task.sourceCorrectionId,
      ]),
    }),
  );
  const runId = stableUuid(`process-mining:${digest}`);
  const snapshots = clustered.map((task) => ({
    ...task,
    id: stableUuid(`${runId}:task-snapshot:${task.id}`),
  }));
  const primaryGroups = selectPrimaryRangeGroups(
    discoverRecurringRangeGroups(enumerateRanges(snapshots)),
  );
  const candidates = primaryGroups.map((completeRanges) => {
    const representativeRange = chooseRepresentative(completeRanges);
    const candidateKey = hash(
      JSON.stringify({
        actions: representativeRange.fingerprint.actions,
        inputs: representativeRange.fingerprint.inputs,
        paths: representativeRange.fingerprint.paths,
        systems: representativeRange.fingerprint.systems,
      }),
    );
    return {
      candidateKey,
      completeRanges,
      id: stableUuid(`${runId}:process-candidate:${candidateKey}`),
      representativeRange,
    };
  });
  return { candidates, digest, runId, snapshots };
}

function zeroDiagnostics(): ProcessMatchDiagnostics {
  return {
    actionScore: 0,
    completionCompatible: false,
    compositeScore: 0,
    containmentScore: 0,
    inputScore: 0,
    labelScore: 0,
    pathScore: 0,
    systemSequenceScore: 0,
  };
}

function instanceForRange(
  range: ProcessRange,
  disposition: ProcessInstanceDisposition,
  label: string,
  outcome: string,
  rationale: string,
  diagnostics: ProcessMatchDiagnostics,
  relatedCandidateKey: string | null,
  confidence: number,
) {
  const first = range.tasks[0]!;
  const last = range.tasks.at(-1)!;
  return {
    apparentOutcome: outcome,
    boundaryRationale: rationale,
    clusterSequence: range.tasks.map((task) => task.clusterKey),
    confidence: Math.min(
      confidence,
      ...range.tasks.map((task) => task.confidence),
    ),
    department: first.department,
    disposition,
    durationSeconds: secondsBetween(first.startedAt, last.endedAt),
    endedAt: last.endedAt,
    id: stableUuid(`process-instance:${range.id}:${disposition}`),
    matchDiagnostics: diagnostics,
    neutralLabel: label,
    observationWindowId: first.observationWindowId,
    rangeFingerprint: range.fingerprintHash,
    relatedCandidateKey,
    role: first.role,
    startedAt: first.startedAt,
    taskSnapshotIds: range.tasks.map((task) => task.id),
  } satisfies MaterializedProcessInstance;
}

function uncoveredRanges(
  snapshots: ProcessTaskSnapshot[],
  completeRanges: ProcessRange[],
) {
  const covered = new Set(
    completeRanges.flatMap((range) => range.tasks.map((task) => task.id)),
  );
  const ranges: ProcessRange[] = [];
  for (const segmentTasks of groupBy(
    snapshots,
    (task) => `${task.observationWindowId}:${task.hardSegmentOrdinal}`,
  ).values()) {
    const ordered = [...segmentTasks].sort(
      (left, right) => left.ordinal - right.ordinal,
    );
    let start: number | null = null;
    for (let index = 0; index <= ordered.length; index += 1) {
      const isUncovered =
        index < ordered.length && !covered.has(ordered[index]!.id);
      if (isUncovered && start === null) start = index;
      if (!isUncovered && start !== null) {
        ranges.push(createRange(ordered, start, index - 1));
        start = null;
      }
    }
  }
  return ranges;
}

function repeatedEntryCount(tasks: ProcessTaskSnapshot[]) {
  const semanticTokens = tasks.flatMap((task) =>
    task.featureTokens.filter((token) => token.startsWith('input:')),
  );
  return Object.values(frequency(semanticTokens)).filter((count) => count > 1)
    .length;
}

function candidateFindings(
  candidateId: string,
  instances: MaterializedProcessInstance[],
  snapshotById: Map<string, ProcessTaskSnapshot>,
) {
  const findings: ProcessFinding[] = [];
  const add = (
    type: ProcessFinding['findingType'],
    severity: ProcessFinding['severity'],
    summary: string,
    evidence: ProcessTaskSnapshot[],
  ) => {
    if (evidence.length === 0) return;
    findings.push({
      evidenceObservationWindowIds: [
        ...new Set(evidence.map((task) => task.observationWindowId)),
      ],
      evidenceTaskSnapshotIds: evidence.map((task) => task.id),
      findingType: type,
      id: stableUuid(`${candidateId}:finding:${type}:${findings.length + 1}`),
      severity,
      summary,
    });
  };
  const tasksByInstance = instances.map((instance) =>
    instance.taskSnapshotIds.map((id) => snapshotById.get(id)!),
  );
  const tasks = tasksByInstance.flat();
  add(
    'loop',
    'medium',
    'The same task repeats consecutively within observed process instances.',
    tasksByInstance.flatMap((instanceTasks) =>
      instanceTasks.filter(
        (task, index) =>
          instanceTasks[index - 1]?.clusterKey === task.clusterKey,
      ),
    ),
  );
  add(
    'backtracking',
    'medium',
    'Observed task sequences return to a recently completed task.',
    tasksByInstance.flatMap((instanceTasks) =>
      instanceTasks.filter(
        (task, index) =>
          index >= 2 &&
          instanceTasks[index - 2]?.clusterKey === task.clusterKey,
      ),
    ),
  );
  const actionTokens = tasks
    .flatMap((task) => task.featureTokens)
    .filter((token) => token.startsWith('action:'));
  const navigationTokens = actionTokens.filter((token) =>
    [
      'action:navigate',
      'action:spa_navigate',
      'action:hash_navigate',
      'action:domain_transition',
      'action:tab_activate',
    ].includes(token),
  );
  if (
    actionTokens.length > 0 &&
    navigationTokens.length / actionTokens.length >= 0.4
  )
    add(
      'navigation_churn',
      'medium',
      'Navigation and transition events make up a large share of the observed process.',
      tasks,
    );
  if (
    new Set(instances.map((instance) => instance.role ?? 'Unspecified')).size >
    1
  )
    add(
      'role_difference',
      'low',
      'Multiple role snapshots perform variants of this recurring process.',
      tasks,
    );
  add(
    'repeated_entry',
    'medium',
    'Semantic input classes repeat across tasks; this may indicate manual re-entry.',
    instances.flatMap((instance) => {
      const instanceTasks = instance.taskSnapshotIds.map(
        (id) => snapshotById.get(id)!,
      );
      return repeatedEntryCount(instanceTasks) > 0 ? instanceTasks : [];
    }),
  );
  add(
    'long_wait',
    'low',
    'At least thirty seconds elapsed between observed browser tasks.',
    instances.flatMap((instance) => {
      const instanceTasks = instance.taskSnapshotIds.map(
        (id) => snapshotById.get(id)!,
      );
      return instanceTasks.filter((task, index) => {
        const previous = instanceTasks[index - 1];
        return previous
          ? secondsBetween(previous.endedAt, task.startedAt) >= 30
          : false;
      });
    }),
  );
  return findings;
}

function buildVariants(
  instances: MaterializedProcessInstance[],
  rangeByInstanceId: Map<string, ProcessRange>,
) {
  const groups: MaterializedProcessInstance[][] = [];
  for (const instance of [...instances].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const range = rangeByInstanceId.get(instance.id)!;
    const group = groups.find((candidate) =>
      candidate.every((member) => {
        const memberRange = rangeByInstanceId.get(member.id)!;
        const score = scoreFingerprints(
          range.fingerprint,
          memberRange.fingerprint,
        );
        return (
          score.compositeScore >= sameVariantThreshold &&
          score.systemSequenceScore === 1
        );
      }),
    );
    if (group) group.push(instance);
    else groups.push([instance]);
  }
  return groups.map((group) => {
    const representative = [...group].sort(
      (left, right) =>
        right.taskSnapshotIds.length - left.taskSnapshotIds.length ||
        left.id.localeCompare(right.id),
    )[0]!;
    return {
      canonicalClusterSequence: representative.clusterSequence,
      instanceIds: group.map((instance) => instance.id),
      representativeInstanceId: representative.id,
      variantKey: hash(
        JSON.stringify(
          group.map((instance) => instance.rangeFingerprint).sort(),
        ),
      ),
    };
  });
}

function materializeCandidate(
  draft: ProcessCandidateDraft,
  label: ProcessCandidateLabel,
  instances: MaterializedProcessInstance[],
  snapshots: ProcessTaskSnapshot[],
  rangeByInstanceId: Map<string, ProcessRange>,
) {
  const snapshotById = new Map(
    snapshots.map((snapshot) => [snapshot.id, snapshot]),
  );
  const allTasks = instances.flatMap((instance) =>
    instance.taskSnapshotIds.map((taskId) => snapshotById.get(taskId)!),
  );
  const durations = instances.map((instance) => instance.durationSeconds);
  const transitionDurations = new Map<string, number[]>();
  for (const instance of instances) {
    const tasks = instance.taskSnapshotIds.map(
      (taskId) => snapshotById.get(taskId)!,
    );
    for (let index = 1; index < tasks.length; index += 1) {
      const previous = tasks[index - 1]!;
      const current = tasks[index]!;
      const key = `${previous.clusterKey}>${current.clusterKey}`;
      transitionDurations.set(key, [
        ...(transitionDurations.get(key) ?? []),
        secondsBetween(previous.endedAt, current.startedAt),
      ]);
    }
  }
  const representativeInstance = instances.find(
    (instance) =>
      rangeByInstanceId.get(instance.id)?.id === draft.representativeRange.id,
  )!;
  const variants = buildVariants(instances, rangeByInstanceId);
  const metrics = {
    backtrackCount: instances.reduce(
      (total, instance) =>
        total +
        instance.clusterSequence.filter(
          (cluster, index) =>
            index >= 2 && instance.clusterSequence[index - 2] === cluster,
        ).length,
      0,
    ),
    crossSystemTransitionCount: instances.reduce((total, instance) => {
      const tasks = instance.taskSnapshotIds.map(
        (taskId) => snapshotById.get(taskId)!,
      );
      return (
        total +
        tasks
          .slice(1)
          .filter((task, index) =>
            task.participatingSystems.some(
              (system) => !tasks[index]!.participatingSystems.includes(system),
            ),
          ).length
      );
    }, 0),
    departmentFrequency: frequency(
      instances.map((instance) => instance.department),
    ),
    instanceCount: instances.length,
    longWaitCount: instances.reduce((total, instance) => {
      const tasks = instance.taskSnapshotIds.map(
        (taskId) => snapshotById.get(taskId)!,
      );
      return (
        total +
        tasks
          .slice(1)
          .filter(
            (task, index) =>
              secondsBetween(tasks[index]!.endedAt, task.startedAt) >= 30,
          ).length
      );
    }, 0),
    loopCount: instances.reduce(
      (total, instance) =>
        total +
        instance.clusterSequence.filter(
          (cluster, index) =>
            index > 0 && instance.clusterSequence[index - 1] === cluster,
        ).length,
      0,
    ),
    medianDurationSeconds: percentile(durations, 0.5),
    medianTaskCount: percentile(
      instances.map((instance) => instance.taskSnapshotIds.length),
      0.5,
    ),
    navigationChurnRatio: (() => {
      const actions = allTasks
        .flatMap((task) => task.featureTokens)
        .filter((token) => token.startsWith('action:'));
      const navigation = actions.filter((token) =>
        [
          'action:navigate',
          'action:spa_navigate',
          'action:hash_navigate',
          'action:domain_transition',
          'action:tab_activate',
        ].includes(token),
      );
      return actions.length === 0 ? 0 : navigation.length / actions.length;
    })(),
    observationCount: new Set(
      instances.map((instance) => instance.observationWindowId),
    ).size,
    p90DurationSeconds: percentile(durations, 0.9),
    possibleAbandonmentCount: instances.filter((instance) => {
      const last = snapshotById.get(instance.taskSnapshotIds.at(-1)!)!;
      return !last.featureTokens.some((token) =>
        ['action:submit', 'action:file_download'].includes(token),
      );
    }).length,
    possibleRepeatedEntryCount: instances.reduce(
      (total, instance) =>
        total +
        repeatedEntryCount(
          instance.taskSnapshotIds.map((id) => snapshotById.get(id)!),
        ),
      0,
    ),
    roleFrequency: frequency(
      instances.map((instance) => instance.role ?? 'Unspecified'),
    ),
    systemFrequency: frequency(
      allTasks.flatMap((task) => task.participatingSystems),
    ),
    taskFrequency: frequency(allTasks.map((task) => task.clusterKey)),
  };
  const candidate = {
    apparentOutcome: label.apparentOutcome,
    candidateKey: draft.candidateKey,
    canonicalClusterSequence: representativeInstance.clusterSequence,
    confidence: Math.min(
      label.confidence,
      ...instances.map((instance) => instance.confidence),
    ),
    evidenceRationale: label.evidenceRationale,
    findings: candidateFindings(draft.id, instances, snapshotById),
    graphEdges: [...transitionDurations.entries()].map(([key, values]) => {
      const [sourceClusterKey, targetClusterKey] = key.split('>') as [
        string,
        string,
      ];
      return {
        medianTransitionSeconds: percentile(values, 0.5),
        occurrenceCount: values.length,
        sourceClusterKey,
        targetClusterKey,
      };
    }),
    id: draft.id,
    instanceIds: instances.map((instance) => instance.id),
    metrics,
    neutralLabel: label.neutralLabel,
    participatingSystems: [
      ...new Set(draft.representativeRange.fingerprint.systems),
    ],
    scope: 'primary' as const,
    variantCount: variants.length,
    variants,
  };
  return processCandidateSchema.parse(candidate);
}

export function finalizeProcessMining(
  draft: ProcessMiningDraft,
  labels: Map<string, ProcessCandidateLabel>,
): ProcessMiningResult {
  const instances: MaterializedProcessInstance[] = [];
  const rangeByInstanceId = new Map<string, ProcessRange>();
  const completeRanges = draft.candidates.flatMap(
    (candidate) => candidate.completeRanges,
  );
  for (const candidate of draft.candidates) {
    const label = labels.get(candidate.id);
    if (!label) throw new Error('missing_process_candidate_label');
    for (const range of candidate.completeRanges) {
      const diagnostics = scoreFingerprints(
        range.fingerprint,
        candidate.representativeRange.fingerprint,
      );
      const instance = instanceForRange(
        range,
        'complete_match',
        label.neutralLabel,
        label.apparentOutcome,
        label.evidenceRationale,
        diagnostics,
        candidate.candidateKey,
        label.confidence,
      );
      instances.push(instance);
      rangeByInstanceId.set(instance.id, range);
    }
  }
  for (const range of uncoveredRanges(draft.snapshots, completeRanges)) {
    const partialCandidate = draft.candidates
      .map((candidate) => ({
        candidate,
        diagnostics: scoreFingerprints(
          range.fingerprint,
          candidate.representativeRange.fingerprint,
        ),
      }))
      .filter(
        ({ diagnostics }) =>
          diagnostics.containmentScore >= partialContainmentThreshold,
      )
      .sort(
        (left, right) =>
          right.diagnostics.containmentScore -
          left.diagnostics.containmentScore,
      )[0];
    if (partialCandidate) {
      const label = labels.get(partialCandidate.candidate.id)!;
      instances.push(
        instanceForRange(
          range,
          'partial_fragment',
          `Partial: ${label.neutralLabel}`,
          range.tasks.map((task) => task.apparentObjective).join(' Then '),
          'This evidence is contained within a recurring process but does not cover its complete observed system and outcome range.',
          partialCandidate.diagnostics,
          partialCandidate.candidate.candidateKey,
          partialCandidate.diagnostics.containmentScore,
        ),
      );
    } else {
      instances.push(
        instanceForRange(
          range,
          'non_recurring',
          range.tasks.map((task) => task.neutralLabel).join(' → '),
          range.tasks.map((task) => task.apparentObjective).join(' Then '),
          'No other non-overlapping observed range met the recurring-process similarity threshold.',
          zeroDiagnostics(),
          null,
          Math.min(...range.tasks.map((task) => task.confidence)),
        ),
      );
    }
  }
  const candidates = draft.candidates.map((candidate) => {
    const candidateInstances = instances.filter(
      (instance) =>
        instance.disposition === 'complete_match' &&
        instance.relatedCandidateKey === candidate.candidateKey,
    );
    return materializeCandidate(
      candidate,
      labels.get(candidate.id)!,
      candidateInstances,
      draft.snapshots,
      rangeByInstanceId,
    );
  });
  const coveredTaskIds = instances.flatMap(
    (instance) => instance.taskSnapshotIds,
  );
  if (
    coveredTaskIds.length !== draft.snapshots.length ||
    new Set(coveredTaskIds).size !== draft.snapshots.length
  )
    throw new Error('invalid_process_instance_coverage');
  return {
    candidates,
    digest: draft.digest,
    instances: instances.sort(
      (left, right) =>
        left.observationWindowId.localeCompare(right.observationWindowId) ||
        left.startedAt.localeCompare(right.startedAt),
    ),
    runId: draft.runId,
    snapshots: draft.snapshots,
    unmatched: [],
  };
}

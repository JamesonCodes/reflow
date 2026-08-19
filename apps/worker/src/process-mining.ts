import { createHash } from 'node:crypto';

import {
  processCandidateSchema,
  processMiningAlgorithmVersion,
  type MiningTask,
  type ProcessBoundaryOutput,
  type ProcessCandidate,
  type ProcessFinding,
} from '@reflow/contracts';

import { stableUuid } from './pipeline';

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

function lcsRatio(left: string[], right: string[]) {
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
  return (
    matrix[left.length]![right.length]! / Math.max(left.length, right.length, 1)
  );
}

function completeLinkGroups<T>(
  values: T[],
  compatible: (left: T, right: T) => boolean,
) {
  const groups: T[][] = [];
  for (const value of values) {
    const group = groups.find((candidate) =>
      candidate.every((member) => compatible(member, value)),
    );
    if (group) group.push(value);
    else groups.push([value]);
  }
  return groups;
}

function groupBy<T>(values: T[], keyFor: (value: T) => string) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
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
  durationSeconds: number;
  endedAt: string;
  id: string;
  neutralLabel: string;
  observationWindowId: string;
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

export interface ProcessMiningResult {
  candidates: ProcessCandidate[];
  digest: string;
  instances: MaterializedProcessInstance[];
  runId: string;
  snapshots: ProcessTaskSnapshot[];
  unmatched: UnmatchedProcessWork[];
}

function taskCompatibility(left: MiningTask, right: MiningTask) {
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
  const groups = completeLinkGroups(ordered, taskCompatibility);
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

export function validateProcessCoverage(
  tasks: MiningTask[],
  output: ProcessBoundaryOutput,
) {
  const expected = new Set(tasks.map((task) => task.ordinal));
  const assigned = new Set<number>();
  const ranges = [
    ...output.processInstances.map((range) => ({
      end: range.endTaskOrdinal,
      start: range.startTaskOrdinal,
    })),
    ...output.excludedRanges.map((range) => ({
      end: range.endTaskOrdinal,
      start: range.startTaskOrdinal,
    })),
  ];
  for (const range of ranges) {
    if (range.end < range.start) throw new Error('invalid_process_range');
    for (let ordinal = range.start; ordinal <= range.end; ordinal += 1) {
      if (!expected.has(ordinal)) throw new Error('invented_process_task');
      if (assigned.has(ordinal))
        throw new Error('overlapping_process_coverage');
      assigned.add(ordinal);
    }
  }
  if (assigned.size !== expected.size)
    throw new Error('incomplete_process_coverage');
}

function repeatedEntryCount(tasks: ProcessTaskSnapshot[]) {
  const semanticTokens = tasks.flatMap((task) =>
    task.featureTokens.filter((token) => token.startsWith('input:')),
  );
  return Object.values(frequency(semanticTokens)).filter((count) => count > 1)
    .length;
}

function materializeInstances(
  snapshots: ProcessTaskSnapshot[],
  outputs: Map<string, ProcessBoundaryOutput>,
) {
  const instances: MaterializedProcessInstance[] = [];
  const unmatched: UnmatchedProcessWork[] = [];
  const segmentGroups = groupBy(
    snapshots,
    (task) => `${task.observationWindowId}:${task.hardSegmentOrdinal}`,
  );
  for (const [segmentKey, segmentTasks] of segmentGroups) {
    const output = outputs.get(segmentKey);
    if (!output) throw new Error('missing_process_boundary_output');
    validateProcessCoverage(segmentTasks, output);
    const byOrdinal = new Map(segmentTasks.map((task) => [task.ordinal, task]));
    for (const [index, range] of output.processInstances.entries()) {
      const tasks = Array.from(
        { length: range.endTaskOrdinal - range.startTaskOrdinal + 1 },
        (_, offset) => byOrdinal.get(range.startTaskOrdinal + offset),
      );
      if (tasks.some((task) => !task)) throw new Error('missing_process_task');
      const resolved = tasks as ProcessTaskSnapshot[];
      const first = resolved[0]!;
      const last = resolved.at(-1)!;
      instances.push({
        apparentOutcome: range.apparentOutcome,
        boundaryRationale: range.boundaryRationale,
        clusterSequence: resolved.map((task) => task.clusterKey),
        confidence: Math.min(
          range.confidence,
          ...resolved.map((task) => task.confidence),
        ),
        department: first.department,
        durationSeconds: secondsBetween(first.startedAt, last.endedAt),
        endedAt: last.endedAt,
        id: stableUuid(
          `${first.id}:process:${index + 1}:${range.startTaskOrdinal}:${range.endTaskOrdinal}`,
        ),
        neutralLabel: range.neutralLabel,
        observationWindowId: first.observationWindowId,
        role: first.role,
        startedAt: first.startedAt,
        taskSnapshotIds: resolved.map((task) => task.id),
      });
    }
    for (const range of output.excludedRanges) {
      const taskSnapshotIds = Array.from(
        { length: range.endTaskOrdinal - range.startTaskOrdinal + 1 },
        (_, offset) => byOrdinal.get(range.startTaskOrdinal + offset)!.id,
      );
      unmatched.push({
        classification: range.classification,
        observationWindowId: segmentTasks[0]!.observationWindowId,
        reason: range.reason,
        taskSnapshotIds,
      });
    }
  }
  return { instances, unmatched };
}

function instanceCompatibility(
  left: MaterializedProcessInstance,
  right: MaterializedProcessInstance,
) {
  return lcsRatio(left.clusterSequence, right.clusterSequence) >= 0.75;
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
  const loopEvidence = tasksByInstance.flatMap((instanceTasks) =>
    instanceTasks.filter(
      (task, index) => instanceTasks[index - 1]?.clusterKey === task.clusterKey,
    ),
  );
  add(
    'loop',
    'medium',
    'The same task repeats consecutively within observed process instances.',
    loopEvidence,
  );
  const backtrackEvidence = tasksByInstance.flatMap((instanceTasks) =>
    instanceTasks.filter((task, index) =>
      index >= 2
        ? instanceTasks[index - 2]?.clusterKey === task.clusterKey
        : false,
    ),
  );
  add(
    'backtracking',
    'medium',
    'Observed task sequences return to a recently completed task.',
    backtrackEvidence,
  );
  const navigationTokens = tasks
    .flatMap((task) => task.featureTokens)
    .filter((token) =>
      [
        'action:navigate',
        'action:spa_navigate',
        'action:hash_navigate',
        'action:domain_transition',
        'action:tab_activate',
      ].includes(token),
    );
  const actionTokens = tasks
    .flatMap((task) => task.featureTokens)
    .filter((token) => token.startsWith('action:'));
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
  const repeatedEntryEvidence = instances.flatMap((instance) => {
    const instanceTasks = instance.taskSnapshotIds.map(
      (id) => snapshotById.get(id)!,
    );
    return repeatedEntryCount(instanceTasks) > 0 ? instanceTasks : [];
  });
  add(
    'repeated_entry',
    'medium',
    'Semantic input classes repeat across tasks; this may indicate manual re-entry.',
    repeatedEntryEvidence,
  );
  const longWaitEvidence = instances.flatMap((instance) => {
    const instanceTasks = instance.taskSnapshotIds.map(
      (id) => snapshotById.get(id)!,
    );
    return instanceTasks.filter((task, index) => {
      const previous = instanceTasks[index - 1];
      return previous
        ? secondsBetween(previous.endedAt, task.startedAt) >= 30
        : false;
    });
  });
  add(
    'long_wait',
    'low',
    'At least thirty seconds elapsed between observed browser tasks.',
    longWaitEvidence,
  );
  return findings;
}

function materializeCandidates(
  instances: MaterializedProcessInstance[],
  snapshots: ProcessTaskSnapshot[],
  runId: string,
) {
  const groups = completeLinkGroups(
    [...instances].sort((left, right) => left.id.localeCompare(right.id)),
    instanceCompatibility,
  ).filter((group) => group.length >= 2);
  const snapshotById = new Map(
    snapshots.map((snapshot) => [snapshot.id, snapshot]),
  );
  return groups.map((group) => {
    const sequences = group.map((instance) => instance.clusterSequence);
    const canonical = [...sequences].sort(
      (left, right) =>
        right.length - left.length ||
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
    )[0]!;
    const candidateKey = hash(
      JSON.stringify(
        [...sequences].map((sequence) => sequence.join('>')).sort(),
      ),
    );
    const id = stableUuid(`${runId}:process-candidate:${candidateKey}`);
    const allTasks = group.flatMap((instance) =>
      instance.taskSnapshotIds.map((taskId) => snapshotById.get(taskId)!),
    );
    const durations = group.map((instance) => instance.durationSeconds);
    const transitionDurations = new Map<string, number[]>();
    for (const instance of group) {
      const tasks = instance.taskSnapshotIds.map(
        (taskId) => snapshotById.get(taskId)!,
      );
      for (let index = 1; index < tasks.length; index += 1) {
        const previous = tasks[index - 1]!;
        const current = tasks[index]!;
        const key = `${previous.clusterKey}>${current.clusterKey}`;
        const values = transitionDurations.get(key) ?? [];
        values.push(secondsBetween(previous.endedAt, current.startedAt));
        transitionDurations.set(key, values);
      }
    }
    const roleValues = group.map((instance) => instance.role ?? 'Unspecified');
    const metrics = {
      backtrackCount: group.reduce(
        (total, instance) =>
          total +
          instance.clusterSequence.filter(
            (cluster, index) =>
              index >= 2 && instance.clusterSequence[index - 2] === cluster,
          ).length,
        0,
      ),
      crossSystemTransitionCount: group.reduce((total, instance) => {
        const tasks = instance.taskSnapshotIds.map(
          (taskId) => snapshotById.get(taskId)!,
        );
        return (
          total +
          tasks
            .slice(1)
            .filter((task, index) =>
              task.participatingSystems.some(
                (system) =>
                  !tasks[index]!.participatingSystems.includes(system),
              ),
            ).length
        );
      }, 0),
      departmentFrequency: frequency(
        group.map((instance) => instance.department),
      ),
      instanceCount: group.length,
      longWaitCount: group.reduce((total, instance) => {
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
      loopCount: group.reduce(
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
        group.map((instance) => instance.taskSnapshotIds.length),
        0.5,
      ),
      navigationChurnRatio: (() => {
        const actionTokens = allTasks
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
        return actionTokens.length === 0
          ? 0
          : navigationTokens.length / actionTokens.length;
      })(),
      observationCount: new Set(
        group.map((instance) => instance.observationWindowId),
      ).size,
      p90DurationSeconds: percentile(durations, 0.9),
      possibleAbandonmentCount: group.filter((instance) => {
        const last = snapshotById.get(instance.taskSnapshotIds.at(-1)!)!;
        return !last.featureTokens.some((token) =>
          ['action:submit', 'action:file_download'].includes(token),
        );
      }).length,
      possibleRepeatedEntryCount: group.reduce(
        (total, instance) =>
          total +
          repeatedEntryCount(
            instance.taskSnapshotIds.map((id) => snapshotById.get(id)!),
          ),
        0,
      ),
      roleFrequency: frequency(roleValues),
      systemFrequency: frequency(
        allTasks.flatMap((task) => task.participatingSystems),
      ),
      taskFrequency: frequency(allTasks.map((task) => task.clusterKey)),
    };
    const variants = new Set(sequences.map((sequence) => sequence.join('>')));
    const candidate = {
      apparentOutcome: group[0]!.apparentOutcome,
      candidateKey,
      canonicalClusterSequence: canonical,
      confidence: Math.min(...group.map((instance) => instance.confidence)),
      findings: candidateFindings(id, group, snapshotById),
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
      id,
      instanceIds: group.map((instance) => instance.id),
      metrics,
      neutralLabel: group[0]!.neutralLabel,
      participatingSystems: [
        ...new Set(allTasks.flatMap((task) => task.participatingSystems)),
      ].sort(),
      variantCount: variants.size,
    };
    return processCandidateSchema.parse(candidate);
  });
}

export function materializeProcessMining(
  tasks: MiningTask[],
  boundaryOutputs: Map<string, ProcessBoundaryOutput>,
  model: string,
): ProcessMiningResult {
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
  const { instances, unmatched } = materializeInstances(
    snapshots,
    boundaryOutputs,
  );
  return {
    candidates: materializeCandidates(instances, snapshots, runId),
    digest,
    instances,
    runId,
    snapshots,
    unmatched,
  };
}

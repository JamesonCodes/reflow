import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  processMiningAlgorithmVersion,
  resolveEffectiveTasks,
  taskCorrectionTypeSchema,
  type Database,
  type Json,
  type MiningTask,
} from '@reflow/contracts';

import type { ProcessMiningResult } from './process-mining';
import { stableUuid } from './pipeline';
import type { ProcessingJob } from './repository';

function requiredData<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(`supabase:${error.message}`);
  if (data === null) throw new Error('supabase:expected_data');
  return data;
}

function asJson(value: unknown): Json {
  return value as Json;
}

function generalizedLabel(value: string | null) {
  if (!value) return null;
  return value
    .toLowerCase()
    .replace(/\[record_id\]|\b\d+\b|\b[a-f0-9]{8,}\b/gi, ':token')
    .replace(/\s+/g, ' ')
    .trim();
}

function groupBy<T>(values: T[], keyFor: (value: T) => string) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    groups.set(keyFor(value), [...(groups.get(keyFor(value)) ?? []), value]);
  }
  return groups;
}

export class ProcessMiningRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async loadEffectiveTasks(departmentId: string): Promise<{
    departmentId: string;
    tasks: MiningTask[];
    workspaceId: string;
  }> {
    const departmentResult = await this.client
      .from('departments')
      .select('id, workspace_id')
      .eq('id', departmentId)
      .single();
    const department = requiredData(
      departmentResult.data,
      departmentResult.error,
    );
    const windowsResult = await this.client
      .from('observation_windows')
      .select(
        'id, workspace_id, department_id, department_snapshot, role_snapshot',
      )
      .eq('workspace_id', department.workspace_id)
      .eq('department_id', departmentId)
      .eq('status', 'completed');
    const windows = requiredData(windowsResult.data, windowsResult.error);
    if (windows.length === 0)
      throw new Error('completed_observations_required');
    const windowIds = windows.map((window) => window.id);
    const runsResult = await this.client
      .from('task_inference_runs')
      .select('id, observation_window_id, created_at')
      .in('observation_window_id', windowIds)
      .order('created_at', { ascending: false });
    const runs = requiredData(runsResult.data, runsResult.error);
    const latestRunByWindow = new Map<string, string>();
    for (const run of runs)
      if (!latestRunByWindow.has(run.observation_window_id))
        latestRunByWindow.set(run.observation_window_id, run.id);
    const runIds = [...latestRunByWindow.values()];
    if (runIds.length === 0)
      throw new Error('successful_task_inference_required');
    const taskResult = await this.client
      .from('task_instances')
      .select('*')
      .in('inference_run_id', runIds)
      .order('task_ordinal');
    const sourceTasks = requiredData(taskResult.data, taskResult.error);
    const taskIds = sourceTasks.map((task) => task.id);
    if (taskIds.length === 0) throw new Error('effective_tasks_required');
    const [
      correctionResult,
      sourceResult,
      taskStepResult,
      stepResult,
      segmentResult,
    ] = await Promise.all([
      this.client
        .from('task_corrections')
        .select('*')
        .eq('workspace_id', department.workspace_id)
        .order('created_at', { ascending: false }),
      this.client
        .from('task_correction_sources')
        .select('*')
        .in('task_instance_id', taskIds),
      this.client
        .from('task_instance_steps')
        .select('*')
        .in('task_instance_id', taskIds)
        .order('step_position'),
      this.client
        .from('normalized_steps')
        .select('*')
        .in('observation_window_id', windowIds)
        .eq('normalization_version', 2)
        .order('step_ordinal'),
      this.client
        .from('activity_segments')
        .select('*')
        .in('observation_window_id', windowIds)
        .eq('normalization_version', 2)
        .order('segment_ordinal'),
    ]);
    const corrections = requiredData(
      correctionResult.data,
      correctionResult.error,
    );
    const correctionSources = requiredData(
      sourceResult.data,
      sourceResult.error,
    );
    const taskSteps = requiredData(taskStepResult.data, taskStepResult.error);
    const steps = requiredData(stepResult.data, stepResult.error);
    const segments = requiredData(segmentResult.data, segmentResult.error);
    const stepById = new Map(steps.map((step) => [step.id, step]));
    const sourceStepIdsByTask = groupBy(
      taskSteps,
      (link) => link.task_instance_id,
    );
    const windowsById = new Map(windows.map((window) => [window.id, window]));
    const output: MiningTask[] = [];
    for (const [windowId, inferenceRunId] of latestRunByWindow) {
      const window = windowsById.get(windowId)!;
      const runTasks = sourceTasks.filter(
        (task) => task.inference_run_id === inferenceRunId,
      );
      const runTaskIds = new Set(runTasks.map((task) => task.id));
      const runCorrections = corrections
        .map((correction) => ({
          correction,
          sourceTaskInstanceIds: correctionSources
            .filter(
              (source) =>
                source.correction_id === correction.id &&
                runTaskIds.has(source.task_instance_id),
            )
            .sort((left, right) => left.source_position - right.source_position)
            .map((source) => source.task_instance_id),
        }))
        .filter(
          ({ sourceTaskInstanceIds }) =>
            sourceTaskInstanceIds.length > 0 &&
            sourceTaskInstanceIds.every((id) => runTaskIds.has(id)),
        );
      const effective = resolveEffectiveTasks(
        runTasks.map((task) => ({
          apparentObjective: task.apparent_objective,
          confidence: Number(task.confidence),
          endStepOrdinal: task.end_step_ordinal,
          id: task.id,
          inferenceRunId,
          neutralLabel: task.neutral_label,
          participatingSystems: task.participating_systems,
          startStepOrdinal: task.start_step_ordinal,
        })),
        runCorrections.map(({ correction, sourceTaskInstanceIds }) => ({
          correctionType: taskCorrectionTypeSchema.parse(
            correction.correction_type,
          ),
          createdAt: correction.created_at,
          id: correction.id,
          replacementLabels: correction.replacement_labels,
          sourceTaskInstanceIds,
          splitAfterStepOrdinal: correction.split_after_step_ordinal,
        })),
      );
      for (const [index, task] of effective.tasks.entries()) {
        const sourceSteps = task.sourceTaskInstanceIds
          .flatMap((taskId) => sourceStepIdsByTask.get(taskId) ?? [])
          .map((link) => stepById.get(link.normalized_step_id))
          .filter((step) => Boolean(step))
          .filter(
            (step) =>
              step!.step_ordinal >= task.startStepOrdinal &&
              step!.step_ordinal <= task.endStepOrdinal,
          )
          .sort((left, right) => left!.step_ordinal - right!.step_ordinal);
        if (sourceSteps.length === 0)
          throw new Error('mining_task_evidence_required');
        const featureTokens = sourceSteps.flatMap((step) =>
          [
            `action:${step!.action_type}`,
            step!.hostname ? `system:${step!.hostname}` : null,
            step!.normalized_path ? `path:${step!.normalized_path}` : null,
            step!.element_role ? `role:${step!.element_role}` : null,
            generalizedLabel(step!.element_label)
              ? `label:${generalizedLabel(step!.element_label)}`
              : null,
            step!.semantic_input_token
              ? `input:${step!.semantic_input_token}`
              : null,
          ].filter((token): token is string => token !== null),
        );
        const segment = segments.find(
          (candidate) =>
            candidate.observation_window_id === windowId &&
            candidate.start_step_ordinal <= task.startStepOrdinal &&
            candidate.end_step_ordinal >= task.endStepOrdinal,
        );
        if (!segment) throw new Error('mining_task_segment_required');
        output.push({
          apparentObjective: task.apparentObjective,
          confidence: task.confidence,
          department: window.department_snapshot,
          departmentId,
          endedAt: sourceSteps.at(-1)!.ended_at,
          endStepOrdinal: task.endStepOrdinal,
          featureTokens,
          hardSegmentOrdinal: segment.segment_ordinal,
          id: stableUuid(`effective-mining-task:${task.effectiveId}`),
          neutralLabel: task.neutralLabel,
          observationWindowId: windowId,
          ordinal: index + 1,
          participatingSystems: task.participatingSystems,
          role: window.role_snapshot,
          sourceCorrectionId: task.correctionId,
          sourceTaskInstanceIds: task.sourceTaskInstanceIds,
          startedAt: sourceSteps[0]!.started_at,
          startStepOrdinal: task.startStepOrdinal,
          workspaceId: department.workspace_id,
        });
      }
    }
    return {
      departmentId,
      tasks: output.sort(
        (left, right) =>
          left.observationWindowId.localeCompare(right.observationWindowId) ||
          left.ordinal - right.ordinal,
      ),
      workspaceId: department.workspace_id,
    };
  }

  async miningExists(runId: string) {
    const { count, error } = await this.client
      .from('process_mining_runs')
      .select('id', { count: 'exact', head: true })
      .eq('id', runId);
    if (error) throw new Error(`supabase:${error.message}`);
    return count === 1;
  }

  async persist(
    job: ProcessingJob,
    model: string,
    promptVersion: number,
    result: ProcessMiningResult,
  ) {
    const workspaceId = result.snapshots[0]?.workspaceId ?? job.workspace_id;
    const snapshots = result.snapshots.map((task) => ({
      apparent_objective: task.apparentObjective,
      cluster_key: task.clusterKey,
      confidence: task.confidence,
      department: task.department,
      ended_at: task.endedAt,
      end_step_ordinal: task.endStepOrdinal,
      feature_signature: task.featureSignature,
      feature_tokens: task.featureTokens,
      hard_segment_ordinal: task.hardSegmentOrdinal,
      id: task.id,
      neutral_label: task.neutralLabel,
      observation_window_id: task.observationWindowId,
      ordinal: task.ordinal,
      participating_systems: task.participatingSystems,
      role: task.role,
      source_correction_id: task.sourceCorrectionId,
      source_task_instance_ids: task.sourceTaskInstanceIds,
      started_at: task.startedAt,
      start_step_ordinal: task.startStepOrdinal,
    }));
    const instances = result.instances.map((instance) => ({
      apparent_outcome: instance.apparentOutcome,
      boundary_rationale: instance.boundaryRationale,
      cluster_sequence: instance.clusterSequence,
      confidence: instance.confidence,
      department: instance.department,
      disposition: instance.disposition,
      duration_seconds: instance.durationSeconds,
      ended_at: instance.endedAt,
      id: instance.id,
      match_diagnostics: instance.matchDiagnostics,
      neutral_label: instance.neutralLabel,
      observation_window_id: instance.observationWindowId,
      range_fingerprint: instance.rangeFingerprint,
      related_candidate_key: instance.relatedCandidateKey,
      role: instance.role,
      started_at: instance.startedAt,
      task_snapshot_ids: instance.taskSnapshotIds,
    }));
    const candidates = result.candidates.map((candidate) => ({
      apparent_outcome: candidate.apparentOutcome,
      candidate_key: candidate.candidateKey,
      canonical_cluster_sequence: candidate.canonicalClusterSequence,
      confidence: candidate.confidence,
      evidence_rationale: candidate.evidenceRationale,
      findings: candidate.findings,
      graph_edges: candidate.graphEdges,
      id: candidate.id,
      instance_ids: candidate.instanceIds,
      metrics: candidate.metrics,
      neutral_label: candidate.neutralLabel,
      participating_systems: candidate.participatingSystems,
      scope: candidate.scope,
      variant_count: candidate.variantCount,
      variants: candidate.variants.map((variant) => ({
        canonical_cluster_sequence: variant.canonicalClusterSequence,
        instance_ids: variant.instanceIds,
        representative_instance_id: variant.representativeInstanceId,
        variant_key: variant.variantKey,
      })),
    }));
    const { data, error } = await this.client.rpc(
      'persist_process_mining_result_v2',
      {
        target_algorithm_version: processMiningAlgorithmVersion,
        target_candidates: asJson(candidates),
        target_department_id: job.entity_id,
        target_input_digest: result.digest,
        target_instances: asJson(instances),
        target_model: model,
        target_prompt_version: promptVersion,
        target_run_id: result.runId,
        target_snapshots: asJson(snapshots),
        target_unmatched: asJson(
          result.unmatched.map((item) => ({
            classification: item.classification,
            observation_window_id: item.observationWindowId,
            reason: item.reason,
            task_snapshot_ids: item.taskSnapshotIds,
          })),
        ),
        target_workspace_id: workspaceId,
      },
    );
    return requiredData(data, error);
  }
}

export function createProcessMiningRepository(url: string, secretKey: string) {
  const client = createClient<Database>(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return new ProcessMiningRepository(client);
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  rawEventForNormalizationSchema,
  type Database,
  type InferredTaskInstance,
  type Json,
  type RawEventForNormalization,
} from '@reflow/contracts';

import type { PreprocessedObservation } from './pipeline';

export type ProcessingJob =
  Database['public']['Tables']['processing_jobs']['Row'];

export interface ObservationContext {
  department: string;
  role: string | null;
  workspaceId: string;
}

export interface PersistInferenceInput {
  model: string;
  preprocessing: PreprocessedObservation;
  promptVersion: number;
  runId: string;
  tasks: InferredTaskInstance[];
  windowId: string;
}

function requiredData<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(`supabase:${error.message}`);
  if (data === null) throw new Error('supabase:expected_data');
  return data;
}

function asJson(value: unknown): Json {
  return value as Json;
}

export class TaskInferenceRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async claim(workerIdentifier: string, batchSize = 5) {
    const { data, error } = await this.client.rpc('claim_processing_jobs', {
      batch_size: batchSize,
      requested_job_types: ['task_inference'],
      worker_identifier: workerIdentifier,
    });
    return requiredData(data, error);
  }

  async loadObservation(windowId: string): Promise<{
    context: ObservationContext;
    events: RawEventForNormalization[];
  }> {
    const windowResult = await this.client
      .from('observation_windows')
      .select('id, workspace_id, department_snapshot, role_snapshot, status')
      .eq('id', windowId)
      .single();
    const window = requiredData(windowResult.data, windowResult.error);
    if (window.status !== 'completed')
      throw new Error('completed_observation_required');

    const eventsResult = await this.client
      .from('raw_event_tokens')
      .select(
        'id, workspace_id, observation_window_id, sequence_no, action_type, hostname, normalized_path, element_role, element_label, page_landmark, semantic_input_token, tab_id, occurred_at',
      )
      .eq('observation_window_id', windowId)
      .order('sequence_no');
    const rows = requiredData(eventsResult.data, eventsResult.error);
    const events = rows.map((event) =>
      rawEventForNormalizationSchema.parse({
        actionType: event.action_type,
        elementLabel: event.element_label,
        elementRole: event.element_role,
        hostname: event.hostname,
        id: event.id,
        normalizedPath: event.normalized_path,
        observationWindowId: event.observation_window_id,
        occurredAt: event.occurred_at,
        pageLandmark: event.page_landmark,
        semanticInputToken: event.semantic_input_token,
        sequenceNo: event.sequence_no,
        tabId: event.tab_id,
        workspaceId: event.workspace_id,
      }),
    );
    if (events.length === 0) throw new Error('observation_events_required');

    return {
      context: {
        department: window.department_snapshot,
        role: window.role_snapshot,
        workspaceId: window.workspace_id,
      },
      events,
    };
  }

  async inferenceExists(runId: string) {
    const { count, error } = await this.client
      .from('task_inference_runs')
      .select('id', { count: 'exact', head: true })
      .eq('id', runId);
    if (error) throw new Error(`supabase:${error.message}`);
    return count === 1;
  }

  async persistInference(input: PersistInferenceInput) {
    const steps = input.preprocessing.steps.map((step) => ({
      action_type: step.actionType,
      boundary_reasons: step.boundaryReasons,
      candidate_boundary_before: step.candidateBoundaryBefore,
      element_label: step.elementLabel,
      element_role: step.elementRole,
      ended_at: step.endedAt,
      hostname: step.hostname,
      id: step.id,
      normalized_path: step.normalizedPath,
      observation_window_id: step.observationWindowId,
      ordinal: step.ordinal,
      page_landmark: step.pageLandmark,
      semantic_input_token: step.semanticInputToken,
      source_event_ids: step.sourceEventIds,
      started_at: step.startedAt,
      step_key: step.stepKey,
      tab_id: step.tabId,
      workspace_id: step.workspaceId,
    }));
    const segments = input.preprocessing.segments.map((segment) => ({
      boundary_reason: segment.boundaryReason,
      end_step_ordinal: segment.endStepOrdinal,
      ended_at: segment.endedAt,
      id: segment.id,
      observation_window_id: segment.observationWindowId,
      ordinal: segment.ordinal,
      started_at: segment.startedAt,
      start_step_ordinal: segment.startStepOrdinal,
      workspace_id: segment.workspaceId,
    }));
    const tasks = input.tasks.map((task) => ({
      apparent_objective: task.apparentObjective,
      boundary_rationale: task.boundaryRationale,
      cluster_id: task.clusterId,
      cluster_key: task.clusterKey,
      confidence: task.confidence,
      end_step_ordinal: task.endStepOrdinal,
      ended_at: task.endedAt,
      id: task.id,
      neutral_label: task.neutralLabel,
      ordinal: task.ordinal,
      participating_systems: task.participatingSystems,
      start_step_ordinal: task.startStepOrdinal,
      started_at: task.startedAt,
      supporting_step_ids: task.supportingStepIds,
    }));

    const { data, error } = await this.client.rpc(
      'persist_task_inference_result',
      {
        target_input_digest: input.preprocessing.digest,
        target_model: input.model,
        target_normalization_version: 1,
        target_observation_window_id: input.windowId,
        target_prompt_version: input.promptVersion,
        target_run_id: input.runId,
        target_segments: asJson(segments),
        target_steps: asJson(steps),
        target_tasks: asJson(tasks),
      },
    );
    return requiredData(data, error);
  }

  async complete(job: ProcessingJob) {
    if (!job.lock_token) throw new Error('processing_job_missing_lock');
    const { data, error } = await this.client.rpc('complete_processing_job', {
      target_job_id: job.id,
      target_lock_token: job.lock_token,
    });
    return requiredData(data, error);
  }

  async fail(
    job: ProcessingJob,
    errorCode: string,
    errorDetail: string,
    retryable: boolean,
  ) {
    if (!job.lock_token) throw new Error('processing_job_missing_lock');
    const { data, error } = await this.client.rpc('fail_processing_job', {
      retryable,
      target_error_code: errorCode,
      target_error_detail: errorDetail,
      target_job_id: job.id,
      target_lock_token: job.lock_token,
    });
    return requiredData(data, error);
  }
}

export function createTaskInferenceRepository(url: string, secretKey: string) {
  const client = createClient<Database>(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return new TaskInferenceRepository(client);
}

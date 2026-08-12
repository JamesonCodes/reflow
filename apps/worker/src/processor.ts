import { inferBrowserTasks } from '@reflow/ai';
import {
  normalizationVersion,
  taskInferencePromptVersion,
} from '@reflow/contracts';

import {
  materializeInference,
  preprocessObservation,
  stableUuid,
} from './pipeline';
import type { ProcessingJob, TaskInferenceRepository } from './repository';

export interface ProcessorConfiguration {
  apiKey: string;
  model: string;
}

export interface ProcessorDependencies {
  infer?: typeof inferBrowserTasks;
  repository: Pick<
    TaskInferenceRepository,
    'complete' | 'inferenceExists' | 'loadObservation' | 'persistInference'
  >;
}

function runIdentity(windowId: string, digest: string, model: string) {
  return stableUuid(
    `${windowId}:${digest}:${model}:${taskInferencePromptVersion}:${normalizationVersion}`,
  );
}

export async function processTaskInferenceJob(
  job: ProcessingJob,
  configuration: ProcessorConfiguration,
  dependencies: ProcessorDependencies,
) {
  const { context, events } = await dependencies.repository.loadObservation(
    job.entity_id,
  );
  const preprocessing = preprocessObservation(events);
  const expectedRunId = runIdentity(
    job.entity_id,
    preprocessing.digest,
    configuration.model,
  );
  if (await dependencies.repository.inferenceExists(expectedRunId)) {
    await dependencies.repository.complete(job);
    return { runId: expectedRunId, skipped: true };
  }

  const infer = dependencies.infer ?? inferBrowserTasks;
  const output = await infer(
    { apiKey: configuration.apiKey, model: configuration.model },
    {
      department: context.department,
      role: context.role,
      steps: preprocessing.steps,
    },
  );
  const materialized = materializeInference(
    output,
    preprocessing,
    configuration.model,
  );
  if (materialized.runId !== expectedRunId)
    throw new Error('inference_identity_mismatch');

  await dependencies.repository.persistInference({
    model: configuration.model,
    preprocessing,
    promptVersion: taskInferencePromptVersion,
    runId: materialized.runId,
    tasks: materialized.tasks,
    windowId: job.entity_id,
  });
  await dependencies.repository.complete(job);
  return { runId: materialized.runId, skipped: false };
}

export function classifyProcessingError(error: unknown) {
  const detail = error instanceof Error ? error.message : 'unknown_error';
  const retryable =
    detail.startsWith('supabase:') ||
    /fetch|network|timeout|rate.?limit|temporar/i.test(detail);
  return {
    code: retryable ? 'temporary_processing_error' : detail.slice(0, 80),
    detail: detail.slice(0, 500),
    retryable,
  };
}

import { inferBrowserTasks, reconcileTaskBoundary } from '@reflow/ai';
import {
  normalizationVersion,
  taskInferencePromptVersion,
} from '@reflow/contracts';

import {
  materializeInference,
  applyBoundaryReconciliation,
  combineBatchOutputs,
  createInferenceBatches,
  markBoundaryUncertain,
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
  reconcile?: typeof reconcileTaskBoundary;
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
  const gatewayConfiguration = {
    apiKey: configuration.apiKey,
    model: configuration.model,
  };
  const batches = createInferenceBatches(preprocessing);
  const batchOutputs = [];
  for (const batch of batches) {
    batchOutputs.push(
      await infer(gatewayConfiguration, {
        assignableEndStepOrdinal: batch.assignableEndStepOrdinal,
        assignableStartStepOrdinal: batch.assignableStartStepOrdinal,
        department: context.department,
        role: context.role,
        steps: batch.steps,
      }),
    );
  }
  let output = combineBatchOutputs(batchOutputs);
  const reconcile = dependencies.reconcile ?? reconcileTaskBoundary;
  for (const batch of batches) {
    const seam = batch.seamAfterStepOrdinal;
    if (seam === null) continue;
    const leftTask = output.tasks.find((task) => task.endStepOrdinal === seam);
    const rightTask = output.tasks.find(
      (task) => task.startStepOrdinal === seam + 1,
    );
    if (!leftTask || !rightTask) continue;
    try {
      const result = await reconcile(gatewayConfiguration, {
        department: context.department,
        leftTask,
        rightTask,
        role: context.role,
        seamStepOrdinal: seam,
        steps: preprocessing.steps.slice(
          Math.max(0, seam - 12),
          Math.min(preprocessing.steps.length, seam + 12),
        ),
      });
      output = applyBoundaryReconciliation(output, seam, result);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'invalid_boundary_reconciliation'
      )
        output = markBoundaryUncertain(output, seam);
      else throw error;
    }
  }
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
    exclusions: materialized.exclusions,
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

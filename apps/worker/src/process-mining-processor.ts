import { inferProcessBoundaries } from '@reflow/ai';
import {
  processMiningPromptVersion,
  type ProcessBoundaryOutput,
} from '@reflow/contracts';

import { materializeProcessMining } from './process-mining';
import type { ProcessMiningRepository } from './process-mining-repository';
import type { ProcessingJob, TaskInferenceRepository } from './repository';

export interface ProcessMiningConfiguration {
  apiKey: string;
  model: string;
}

export interface ProcessMiningDependencies {
  infer?: typeof inferProcessBoundaries;
  repository: Pick<
    ProcessMiningRepository,
    'loadEffectiveTasks' | 'miningExists' | 'persist'
  >;
  jobs: Pick<TaskInferenceRepository, 'complete'>;
}

function groupBy<T>(values: T[], keyFor: (value: T) => string) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    groups.set(keyFor(value), [...(groups.get(keyFor(value)) ?? []), value]);
  }
  return groups;
}

export async function processMiningJob(
  job: ProcessingJob,
  configuration: ProcessMiningConfiguration,
  dependencies: ProcessMiningDependencies,
) {
  const input = await dependencies.repository.loadEffectiveTasks(job.entity_id);
  const grouped = groupBy(
    input.tasks,
    (task) => `${task.observationWindowId}:${task.hardSegmentOrdinal}`,
  );
  const infer = dependencies.infer ?? inferProcessBoundaries;
  const outputs = new Map<string, ProcessBoundaryOutput>();
  for (const [segmentKey, tasks] of grouped) {
    outputs.set(
      segmentKey,
      await infer(
        { apiKey: configuration.apiKey, model: configuration.model },
        {
          department: tasks[0]!.department,
          role: tasks[0]!.role,
          tasks,
        },
      ),
    );
  }
  const result = materializeProcessMining(
    input.tasks,
    outputs,
    configuration.model,
  );
  if (!(await dependencies.repository.miningExists(result.runId)))
    await dependencies.repository.persist(
      job,
      configuration.model,
      processMiningPromptVersion,
      result,
    );
  await dependencies.jobs.complete(job);
  return {
    candidateCount: result.candidates.length,
    instanceCount: result.instances.length,
    runId: result.runId,
  };
}

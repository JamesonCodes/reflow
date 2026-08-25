import { labelProcessCandidate } from '@reflow/ai';
import {
  processMiningPromptVersion,
  type ProcessCandidateLabel,
} from '@reflow/contracts';

import { finalizeProcessMining, prepareProcessMining } from './process-mining';
import type { ProcessMiningRepository } from './process-mining-repository';
import type { ProcessingJob, TaskInferenceRepository } from './repository';

export interface ProcessMiningConfiguration {
  apiKey: string;
  model: string;
}

export interface ProcessMiningDependencies {
  label?: typeof labelProcessCandidate;
  repository: Pick<
    ProcessMiningRepository,
    'loadEffectiveTasks' | 'miningExists' | 'persist'
  >;
  jobs: Pick<TaskInferenceRepository, 'complete'>;
}

export async function processMiningJob(
  job: ProcessingJob,
  configuration: ProcessMiningConfiguration,
  dependencies: ProcessMiningDependencies,
) {
  const input = await dependencies.repository.loadEffectiveTasks(job.entity_id);
  const draft = prepareProcessMining(input.tasks, configuration.model);
  const label = dependencies.label ?? labelProcessCandidate;
  const labels = new Map<string, ProcessCandidateLabel>();
  for (const candidate of draft.candidates) {
    labels.set(
      candidate.id,
      await label(
        { apiKey: configuration.apiKey, model: configuration.model },
        {
          department: candidate.representativeRange.tasks[0]!.department,
          representativeTasks: candidate.representativeRange.tasks,
          role: candidate.representativeRange.tasks[0]!.role,
          supportingRanges: candidate.completeRanges.map((range) => ({
            observationWindowId: range.observationWindowId,
            systems: range.fingerprint.systems,
            taskLabels: range.tasks.map((task) => task.neutralLabel),
          })),
        },
      ),
    );
  }
  const result = finalizeProcessMining(draft, labels);
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

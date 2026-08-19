import { randomUUID } from 'node:crypto';

import { workerEnvironmentSchema } from '@reflow/contracts';

import { classifyProcessingError, processTaskInferenceJob } from './processor';
import { processMiningJob } from './process-mining-processor';
import { createProcessMiningRepository } from './process-mining-repository';
import { createTaskInferenceRepository } from './repository';

const pollIntervalMilliseconds = 2_000;

export async function startWorker(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const parsed = workerEnvironmentSchema.safeParse(environment);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => issue.path.join('.'))
      .join(', ');
    throw new Error(`Invalid Reflow worker configuration: ${missing}`);
  }

  const configuration = {
    apiKey: parsed.data.AI_GATEWAY_API_KEY,
    processMiningModel: parsed.data.REFLOW_PROCESS_MINING_MODEL,
    model: parsed.data.REFLOW_TASK_INFERENCE_MODEL,
  };
  const repository = createTaskInferenceRepository(
    parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    parsed.data.SUPABASE_SECRET_KEY,
  );
  const processMiningRepository = createProcessMiningRepository(
    parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    parsed.data.SUPABASE_SECRET_KEY,
  );
  const workerIdentifier = `reflow-local-${randomUUID()}`;

  console.log(
    `Reflow worker started with task model ${configuration.model} and process model ${configuration.processMiningModel}.`,
  );
  for (;;) {
    try {
      const jobs = await repository.claim(workerIdentifier);
      for (const job of jobs) {
        try {
          if (job.job_type === 'process_mining') {
            await processMiningJob(
              job,
              {
                apiKey: configuration.apiKey,
                model: configuration.processMiningModel,
              },
              { jobs: repository, repository: processMiningRepository },
            );
            console.log(`Completed process mining job ${job.id}.`);
          } else {
            await processTaskInferenceJob(job, configuration, { repository });
            console.log(`Completed task inference job ${job.id}.`);
          }
        } catch (error) {
          const failure = classifyProcessingError(error);
          try {
            await repository.fail(
              job,
              failure.code,
              failure.detail,
              failure.retryable,
            );
          } catch (failureUpdateError) {
            console.error(
              `Could not update failed ${job.job_type} job ${job.id}: ${classifyProcessingError(failureUpdateError).detail}`,
            );
          }
          console.error(
            `${job.job_type} job ${job.id} failed: ${failure.detail}`,
          );
        }
      }
    } catch (error) {
      console.error(
        `Task inference poll failed: ${classifyProcessingError(error).detail}`,
      );
    }
    await new Promise((resolve) =>
      setTimeout(resolve, pollIntervalMilliseconds),
    );
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  void startWorker().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

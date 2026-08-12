import { randomUUID } from 'node:crypto';

import { workerEnvironmentSchema } from '@reflow/contracts';

import { classifyProcessingError, processTaskInferenceJob } from './processor';
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
    model: parsed.data.REFLOW_TASK_INFERENCE_MODEL,
  };
  const repository = createTaskInferenceRepository(
    parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    parsed.data.SUPABASE_SECRET_KEY,
  );
  const workerIdentifier = `reflow-local-${randomUUID()}`;

  console.log(
    `Reflow task inference worker started with ${configuration.model}.`,
  );
  for (;;) {
    try {
      const jobs = await repository.claim(workerIdentifier);
      for (const job of jobs) {
        try {
          await processTaskInferenceJob(job, configuration, { repository });
          console.log(`Completed task inference job ${job.id}.`);
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
              `Could not update failed task inference job ${job.id}: ${classifyProcessingError(failureUpdateError).detail}`,
            );
          }
          console.error(
            `Task inference job ${job.id} failed: ${failure.detail}`,
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

import {
  taskInferenceOutputSchema,
  taskInferencePromptVersion,
  type NormalizedStep,
  type TaskInferenceOutput,
} from '@reflow/contracts';
import { createGateway, generateText, Output } from 'ai';

export interface TaskInferenceGatewayConfiguration {
  apiKey: string;
  model: string;
}

export interface TaskInferenceRequest {
  department: string;
  role: string | null;
  steps: NormalizedStep[];
}

export type StructuredTaskGenerator = (
  configuration: TaskInferenceGatewayConfiguration,
  prompt: string,
) => Promise<unknown>;

function promptForTaskInference(request: TaskInferenceRequest) {
  const evidence = request.steps.map((step) => ({
    action: step.actionType,
    boundaryCandidate: step.candidateBoundaryBefore,
    boundaryReasons: step.boundaryReasons,
    control: step.elementLabel,
    controlRole: step.elementRole,
    inputClass: step.semanticInputToken,
    landmark: step.pageLandmark,
    ordinal: step.ordinal,
    path: step.normalizedPath,
    system: step.hostname,
    tab: step.tabId,
    timestamp: step.startedAt,
  }));

  return [
    'Infer bounded browser tasks from sanitized observation evidence.',
    'Do not assume a documented workflow or invent business intent.',
    'Keep approved cross-system work connected when the evidence supports one objective.',
    'Treat five-minute idle boundaries as hard boundaries. Other boundary hints are candidates only.',
    'Use neutral task labels and apparent objectives. Every task range must reference existing ordered steps.',
    'Noise may be omitted, but task ranges must not overlap.',
    `Department context: ${request.department}`,
    `Role context: ${request.role ?? 'Unspecified'}`,
    `Prompt version: ${taskInferencePromptVersion}`,
    `Sanitized steps: ${JSON.stringify(evidence)}`,
  ].join('\n');
}

async function generateThroughGateway(
  configuration: TaskInferenceGatewayConfiguration,
  prompt: string,
) {
  const gateway = createGateway({ apiKey: configuration.apiKey });
  const result = await generateText({
    model: gateway(configuration.model),
    output: Output.object({
      description: 'Evidence-backed browser task boundaries',
      name: 'reflow_task_inference',
      schema: taskInferenceOutputSchema,
    }),
    prompt,
    providerOptions: {
      gateway: {
        tags: [
          'reflow',
          'task-inference',
          `prompt-v${taskInferencePromptVersion}`,
        ],
      },
    },
  });
  return result.output;
}

export async function inferBrowserTasks(
  configuration: TaskInferenceGatewayConfiguration,
  request: TaskInferenceRequest,
  generate: StructuredTaskGenerator = generateThroughGateway,
): Promise<TaskInferenceOutput> {
  if (!configuration.apiKey) throw new Error('ai_gateway_key_required');
  if (!configuration.model) throw new Error('task_inference_model_required');
  if (request.steps.length === 0) return { tasks: [] };

  const generated = await generate(
    configuration,
    promptForTaskInference(request),
  );
  const parsed = taskInferenceOutputSchema.safeParse(generated);
  if (!parsed.success) throw new Error('invalid_task_inference_output');
  return parsed.data;
}

export const aiGatewayBoundary = {
  provider: 'vercel-ai-gateway',
  structuredOutput: 'Output.object',
} as const;

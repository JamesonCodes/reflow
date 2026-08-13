import {
  taskBoundaryReconciliationSchema,
  taskInferenceOutputSchema,
  taskInferencePromptVersion,
  type NormalizedStep,
  type TaskBoundaryReconciliation,
  type TaskInferenceOutput,
} from '@reflow/contracts';
import { createGateway, generateText, Output } from 'ai';

export interface TaskInferenceGatewayConfiguration {
  apiKey: string;
  model: string;
}

export interface TaskInferenceRequest {
  assignableEndStepOrdinal?: number;
  assignableStartStepOrdinal?: number;
  department: string;
  role: string | null;
  steps: NormalizedStep[];
}

export type StructuredTaskGenerator = (
  configuration: TaskInferenceGatewayConfiguration,
  prompt: string,
) => Promise<unknown>;

function promptForTaskInference(request: TaskInferenceRequest) {
  const assignableStart =
    request.assignableStartStepOrdinal ?? request.steps[0]?.ordinal ?? 1;
  const assignableEnd =
    request.assignableEndStepOrdinal ?? request.steps.at(-1)?.ordinal ?? 0;
  const evidence = request.steps.map((step) => ({
    action: step.actionType,
    boundaryCandidate: step.candidateBoundaryBefore,
    boundaryReasons: step.boundaryReasons,
    control: step.elementLabel,
    controlRole: step.elementRole,
    inputClass: step.semanticInputToken,
    interactionGroup: step.interactionGroupId,
    landmark: step.pageLandmark,
    ordinal: step.ordinal,
    path: step.normalizedPath,
    system: step.hostname,
    tab: step.tabId,
    timestamp: step.startedAt,
    assignable:
      step.ordinal >= assignableStart && step.ordinal <= assignableEnd,
  }));

  return [
    'Infer bounded browser business tasks from sanitized observation evidence.',
    'A task is a meaningful business activity or outcome, not browser mechanics.',
    'Do not assume a documented workflow or invent business intent.',
    'Never claim a tab was opened or another browser gesture occurred unless an explicit event proves it.',
    'Keep approved cross-system work connected when the evidence supports one objective.',
    'Treat five-minute idle boundaries as hard boundaries. Other boundary hints are candidates only.',
    'Startup page context is observation_context, not a task.',
    'Navigation-only or link-transport-only work is transport_only unless it completes the preceding substantive task.',
    'A trailing return navigation belongs to the preceding task unless substantive new work begins.',
    'Use neutral evidence-backed labels and objectives; do not infer unsupported intent.',
    'Classify every assignable step exactly once in either a non-overlapping task or excluded range.',
    'Read-only context steps support boundary decisions but must never appear in an output range.',
    `Assignable range: ${assignableStart}-${assignableEnd}`,
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
  if (request.steps.length === 0) return { excludedRanges: [], tasks: [] };

  const generated = await generate(
    configuration,
    promptForTaskInference(request),
  );
  const parsed = taskInferenceOutputSchema.safeParse(generated);
  if (!parsed.success) throw new Error('invalid_task_inference_output');
  return parsed.data;
}

export interface TaskBoundaryReconciliationRequest {
  department: string;
  leftTask: TaskInferenceOutput['tasks'][number];
  rightTask: TaskInferenceOutput['tasks'][number];
  role: string | null;
  seamStepOrdinal: number;
  steps: NormalizedStep[];
}

function promptForBoundaryReconciliation(
  request: TaskBoundaryReconciliationRequest,
) {
  return [
    'Decide whether two task candidates separated only by an inference batch seam are one business task.',
    'Keep them separate unless the sanitized evidence supports one continuous objective.',
    'Never merge across a five-minute idle boundary or invent an unsupported objective.',
    `Department context: ${request.department}`,
    `Role context: ${request.role ?? 'Unspecified'}`,
    `Seam after step: ${request.seamStepOrdinal}`,
    `Left candidate: ${JSON.stringify(request.leftTask)}`,
    `Right candidate: ${JSON.stringify(request.rightTask)}`,
    `Boundary evidence: ${JSON.stringify(request.steps)}`,
  ].join('\n');
}

async function reconcileThroughGateway(
  configuration: TaskInferenceGatewayConfiguration,
  prompt: string,
) {
  const gateway = createGateway({ apiKey: configuration.apiKey });
  const result = await generateText({
    model: gateway(configuration.model),
    output: Output.object({
      description: 'Validated task-boundary reconciliation',
      name: 'reflow_task_boundary_reconciliation',
      schema: taskBoundaryReconciliationSchema,
    }),
    prompt,
    providerOptions: {
      gateway: { tags: ['reflow', 'task-boundary-reconciliation'] },
    },
  });
  return result.output;
}

export async function reconcileTaskBoundary(
  configuration: TaskInferenceGatewayConfiguration,
  request: TaskBoundaryReconciliationRequest,
  generate: StructuredTaskGenerator = reconcileThroughGateway,
): Promise<TaskBoundaryReconciliation> {
  const generated = await generate(
    configuration,
    promptForBoundaryReconciliation(request),
  );
  const parsed = taskBoundaryReconciliationSchema.safeParse(generated);
  if (!parsed.success) throw new Error('invalid_boundary_reconciliation');
  return parsed.data;
}

export const aiGatewayBoundary = {
  provider: 'vercel-ai-gateway',
  structuredOutput: 'Output.object',
} as const;

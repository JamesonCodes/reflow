export {
  adminEnvironmentSchema,
  browserEnvironmentSchema,
  trustedEnvironmentSchema,
  workerEnvironmentSchema,
  type AdminEnvironment,
  type BrowserEnvironment,
  type TrustedEnvironment,
  type WorkerEnvironment,
} from './environment';
export {
  capturedActionTypeSchema,
  capturedHostnameSchema,
  normalizedBrowserPathSchema,
  observationWindowSchema,
  observationWindowStatusSchema,
  queuedCapturedEventSchema,
  sanitizedCapturedEventSchema,
  semanticInputTokenSchema,
  type CapturedActionType,
  type ObservationWindow,
  type QueuedCapturedEvent,
  type SanitizedCapturedEvent,
} from './observation';
export {
  approvedHostnameSchema,
  departmentNameSchema,
  inviteCodeSchema,
  observerDefaultsSchema,
  privacyPathPrefixSchema,
  roleNameSchema,
  workspaceNameSchema,
  type ObserverDefaultsInput,
} from './study';
export {
  activitySegmentSchema,
  inferredTaskInstanceSchema,
  normalizationVersion,
  normalizedStepSchema,
  rawEventForNormalizationSchema,
  taskCorrectionInputSchema,
  taskCorrectionTypeSchema,
  taskInferenceOutputSchema,
  taskInferencePromptVersion,
  taskInferenceTaskSchema,
  type ActivitySegment,
  type InferredTaskInstance,
  type NormalizedStep,
  type RawEventForNormalization,
  type TaskCorrectionInput,
  type TaskInferenceOutput,
} from './task-inference';
export {
  Constants as databaseConstants,
  type CompositeTypes,
  type Database,
  type Enums,
  type Json,
  type Tables,
  type TablesInsert,
  type TablesUpdate,
} from './database.types';

export const projectIdentity = {
  name: 'Reflow',
  packageScope: '@reflow',
} as const;

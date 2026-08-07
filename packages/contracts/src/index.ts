export {
  adminEnvironmentSchema,
  browserEnvironmentSchema,
  trustedEnvironmentSchema,
  type AdminEnvironment,
  type BrowserEnvironment,
  type TrustedEnvironment,
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

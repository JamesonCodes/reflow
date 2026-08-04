export {
  browserEnvironmentSchema,
  trustedEnvironmentSchema,
  type BrowserEnvironment,
  type TrustedEnvironment,
} from './environment';
export {
  capturedActionTypeSchema,
  observationWindowSchema,
  observationWindowStatusSchema,
  sanitizedCapturedEventSchema,
  type CapturedActionType,
  type ObservationWindow,
  type SanitizedCapturedEvent,
} from './observation';
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

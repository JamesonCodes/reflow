export {
  browserEnvironmentSchema,
  trustedEnvironmentSchema,
  type BrowserEnvironment,
  type TrustedEnvironment,
} from './environment';

export const projectIdentity = {
  name: 'Reflow',
  packageScope: '@reflow',
} as const;

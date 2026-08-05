import { z } from 'zod';

export const workspaceNameSchema = z.string().trim().min(1).max(120);
export const departmentNameSchema = z.string().trim().min(1).max(120);
export const roleNameSchema = z.string().trim().min(1).max(120);

export const approvedHostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(253)
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/,
    'Enter a hostname without a protocol or path',
  );

export const privacyPathPrefixSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .startsWith('/')
  .refine((value) => !value.includes('?') && !value.includes('#'), {
    message: 'Path exclusions cannot contain a query string or fragment',
  });

export const inviteCodeSchema = z.string().trim().min(8).max(128);

export const observerDefaultsSchema = z
  .strictObject({
    workspaceId: z.uuid(),
    observerId: z.uuid(),
    departmentId: z.uuid(),
    jobRoleId: z.uuid().nullable(),
    customRole: roleNameSchema.nullable(),
  })
  .refine(
    ({ customRole, jobRoleId }) =>
      (jobRoleId !== null && customRole === null) ||
      (jobRoleId === null && customRole !== null),
    { message: 'Select a common role or enter a custom role' },
  );

export type ObserverDefaultsInput = z.infer<typeof observerDefaultsSchema>;

import { z } from 'zod';

export const capturedActionTypeSchema = z.enum([
  'click',
  'input',
  'submit',
  'navigate',
  'spa_navigate',
  'hash_navigate',
  'tab_activate',
  'domain_transition',
  'file_upload',
  'file_download',
  'out_of_scope_gap',
]);

const hostnameSchema = z
  .string()
  .min(1)
  .max(253)
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/,
  );

const normalizedPathSchema = z
  .string()
  .min(1)
  .max(512)
  .startsWith('/')
  .refine((value) => !value.includes('?') && !value.includes('#'));

const semanticInputTokenSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^\[[A-Z][A-Z0-9_]*(?::[A-Z0-9_-]+)?\]$/);

export const sanitizedCapturedEventSchema = z
  .strictObject({
    id: z.uuid(),
    observationWindowId: z.uuid(),
    workspaceId: z.uuid(),
    observerId: z.uuid(),
    sequenceNo: z.number().int().positive(),
    actionType: capturedActionTypeSchema,
    hostname: hostnameSchema.nullable(),
    normalizedPath: normalizedPathSchema.nullable(),
    elementRole: z.string().min(1).max(64).nullable(),
    elementLabel: z.string().min(1).max(160).nullable(),
    pageLandmark: z.string().min(1).max(160).nullable(),
    semanticInputToken: semanticInputTokenSchema.nullable(),
    tabId: z.number().int().positive(),
    occurredAt: z.iso.datetime({ offset: true }),
  })
  .superRefine((event, context) => {
    if (event.actionType === 'out_of_scope_gap') {
      const scopedFields = [
        event.hostname,
        event.normalizedPath,
        event.elementRole,
        event.elementLabel,
        event.pageLandmark,
        event.semanticInputToken,
      ];

      if (scopedFields.some((value) => value !== null)) {
        context.addIssue({
          code: 'custom',
          message: 'Out-of-scope gaps cannot include hostname or DOM metadata',
        });
      }
    } else if (event.hostname === null) {
      context.addIssue({
        code: 'custom',
        message: 'Observed events require an approved hostname',
        path: ['hostname'],
      });
    }
  });

export const observationWindowStatusSchema = z.enum([
  'active',
  'paused',
  'completed',
  'cancelled',
]);

export const observationWindowSchema = z.strictObject({
  id: z.uuid(),
  workspaceId: z.uuid(),
  observerId: z.uuid(),
  installationId: z.uuid(),
  departmentId: z.uuid(),
  jobRoleId: z.uuid().nullable(),
  departmentSnapshot: z.string().min(1).max(120),
  roleSnapshot: z.string().min(1).max(120).nullable(),
  status: observationWindowStatusSchema,
  startedAt: z.iso.datetime({ offset: true }),
  pausedAt: z.iso.datetime({ offset: true }).nullable(),
  endedAt: z.iso.datetime({ offset: true }).nullable(),
});

export type CapturedActionType = z.infer<typeof capturedActionTypeSchema>;
export type SanitizedCapturedEvent = z.infer<
  typeof sanitizedCapturedEventSchema
>;
export type ObservationWindow = z.infer<typeof observationWindowSchema>;

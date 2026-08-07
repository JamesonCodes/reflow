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

export const capturedHostnameSchema = z
  .string()
  .min(1)
  .max(253)
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/,
  );

export const normalizedBrowserPathSchema = z
  .string()
  .min(1)
  .max(512)
  .startsWith('/')
  .refine((value) => !value.includes('?') && !value.includes('#'));

export const semanticInputTokenSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^\[[A-Z][A-Z0-9_]*(?::[A-Z0-9_-]+)?\]$/);

const boundedSanitizedTextSchema = z
  .string()
  .min(1)
  .max(160)
  .refine(
    (value) =>
      !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value) &&
      !/(?:\+?\d[\d ().-]{5,}\d)/.test(value) &&
      !/(?:\d[ -]?){13,19}/.test(value) &&
      !/\b\d{3}-?\d{2}-?\d{4}\b/.test(value) &&
      !/https?:\/\//i.test(value) &&
      !/<[^>]+>/.test(value),
    'Sanitized text cannot contain PII, URLs, or HTML',
  );

const elementRoleSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_-]*$/);

/** The only browser event shape permitted across extension IPC. */
export const sanitizedCapturedEventSchema = z
  .strictObject({
    clientEventId: z.uuid(),
    actionType: capturedActionTypeSchema,
    hostname: capturedHostnameSchema.nullable(),
    normalizedPath: normalizedBrowserPathSchema.nullable(),
    elementRole: elementRoleSchema.nullable(),
    elementLabel: boundedSanitizedTextSchema.nullable(),
    pageLandmark: boundedSanitizedTextSchema.nullable(),
    semanticInputToken: semanticInputTokenSchema.nullable(),
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

/** Sanitized event after the service worker adds trusted identity and ordering. */
export const queuedCapturedEventSchema = z.strictObject({
  id: z.uuid(),
  observationWindowId: z.uuid(),
  workspaceId: z.uuid(),
  observerId: z.uuid(),
  sequenceNo: z.number().int().positive(),
  actionType: capturedActionTypeSchema,
  hostname: capturedHostnameSchema.nullable(),
  normalizedPath: normalizedBrowserPathSchema.nullable(),
  elementRole: elementRoleSchema.nullable(),
  elementLabel: boundedSanitizedTextSchema.nullable(),
  pageLandmark: boundedSanitizedTextSchema.nullable(),
  semanticInputToken: semanticInputTokenSchema.nullable(),
  tabId: z.number().int().positive(),
  occurredAt: z.iso.datetime({ offset: true }),
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
export type QueuedCapturedEvent = z.infer<typeof queuedCapturedEventSchema>;
export type ObservationWindow = z.infer<typeof observationWindowSchema>;

import { sanitizedCapturedEventSchema } from '@reflow/contracts';
import { z } from 'zod';

const nullableRoleChoiceSchema = z.strictObject({
  customRole: z.string().trim().min(1).max(120).nullable(),
  departmentId: z.uuid(),
  jobRoleId: z.uuid().nullable(),
});

export const extensionRequestSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('setup:get') }),
  z.strictObject({ type: z.literal('setup:join'), inviteCode: z.string() }),
  z.strictObject({
    type: z.literal('setup:save-defaults'),
    ...nullableRoleChoiceSchema.shape,
  }),
  z.strictObject({
    type: z.literal('recording:start'),
    ...nullableRoleChoiceSchema.shape,
  }),
  z.strictObject({ type: z.literal('recording:pause') }),
  z.strictObject({ type: z.literal('recording:resume') }),
  z.strictObject({ type: z.literal('recording:stop') }),
  z.strictObject({ type: z.literal('content:get-config') }),
  z.strictObject({ type: z.literal('capture:document-ready') }),
  z.strictObject({
    type: z.literal('capture:event'),
    event: sanitizedCapturedEventSchema,
  }),
]);

export type ExtensionRequest = z.infer<typeof extensionRequestSchema>;

export const maximumIpcBytes = 4096;

export function parseExtensionRequest(input: unknown) {
  let serialized: string;
  try {
    serialized = JSON.stringify(input);
  } catch {
    return null;
  }
  if (new TextEncoder().encode(serialized).byteLength > maximumIpcBytes)
    return null;
  const parsed = extensionRequestSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

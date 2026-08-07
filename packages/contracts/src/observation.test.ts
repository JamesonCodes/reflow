import { describe, expect, it } from 'vitest';

import {
  queuedCapturedEventSchema,
  sanitizedCapturedEventSchema,
} from './observation';

const validEvent = {
  clientEventId: '10000000-0000-4000-8000-000000000001',
  actionType: 'input',
  hostname: 'billing.example.test',
  normalizedPath: '/invoices/new',
  elementRole: 'textbox',
  elementLabel: 'Invoice amount',
  pageLandmark: 'Invoice form',
  semanticInputToken: '[NUMBER:CURRENCY]',
  occurredAt: '2026-08-01T12:00:00.000Z',
} as const;

describe('sanitizedCapturedEventSchema', () => {
  it('accepts only normalized browser metadata across IPC', () => {
    expect(sanitizedCapturedEventSchema.parse(validEvent)).toEqual(validEvent);
  });

  it('rejects raw values, arbitrary metadata, and PII-bearing labels', () => {
    expect(
      sanitizedCapturedEventSchema.safeParse({
        ...validEvent,
        rawValue: 'person@example.com',
      }).success,
    ).toBe(false);
    expect(
      sanitizedCapturedEventSchema.safeParse({
        ...validEvent,
        elementLabel: 'person@example.com',
      }).success,
    ).toBe(false);
  });

  it('removes all scoped metadata from out-of-scope gaps', () => {
    expect(
      sanitizedCapturedEventSchema.safeParse({
        ...validEvent,
        actionType: 'out_of_scope_gap',
      }).success,
    ).toBe(false);

    expect(
      sanitizedCapturedEventSchema.safeParse({
        ...validEvent,
        actionType: 'out_of_scope_gap',
        hostname: null,
        normalizedPath: null,
        elementRole: null,
        elementLabel: null,
        pageLandmark: null,
        semanticInputToken: null,
      }).success,
    ).toBe(true);
  });

  it('separates trusted queue identity from content-script IPC', () => {
    const { clientEventId, ...sanitizedFields } = validEvent;
    expect(
      queuedCapturedEventSchema.parse({
        ...sanitizedFields,
        id: clientEventId,
        observationWindowId: '10000000-0000-4000-8000-000000000002',
        workspaceId: '10000000-0000-4000-8000-000000000003',
        observerId: '10000000-0000-4000-8000-000000000004',
        sequenceNo: 1,
        tabId: 1,
      }),
    ).toMatchObject({ sequenceNo: 1, tabId: 1 });
  });
});

import { describe, expect, it } from 'vitest';

import { sanitizedCapturedEventSchema } from './observation';

const validEvent = {
  id: '10000000-0000-4000-8000-000000000001',
  observationWindowId: '10000000-0000-4000-8000-000000000002',
  workspaceId: '10000000-0000-4000-8000-000000000003',
  observerId: '10000000-0000-4000-8000-000000000004',
  sequenceNo: 1,
  actionType: 'input',
  hostname: 'billing.example.test',
  normalizedPath: '/invoices/new',
  elementRole: 'textbox',
  elementLabel: 'Invoice amount',
  pageLandmark: 'Invoice form',
  semanticInputToken: '[NUMBER:CURRENCY]',
  tabId: 1,
  occurredAt: '2026-08-01T12:00:00.000Z',
} as const;

describe('sanitizedCapturedEventSchema', () => {
  it('accepts only normalized browser metadata', () => {
    expect(sanitizedCapturedEventSchema.parse(validEvent)).toEqual(validEvent);
  });

  it('rejects raw values and arbitrary metadata', () => {
    expect(
      sanitizedCapturedEventSchema.safeParse({
        ...validEvent,
        rawValue: 'person@example.com',
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
});

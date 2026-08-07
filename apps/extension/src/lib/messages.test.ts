import { describe, expect, it } from 'vitest';

import { maximumIpcBytes, parseExtensionRequest } from './messages';
import { createSanitizedEvent } from './sanitizer';

const event = createSanitizedEvent(
  'https://billing.example.test/invoices/new',
  { actionType: 'click', elementLabel: 'Create invoice' },
  new Date('2026-08-01T12:00:00.000Z'),
  '10000000-0000-4000-8000-000000000001',
);

describe('extension IPC boundary', () => {
  it('accepts only the shared sanitized event contract', () => {
    expect(
      parseExtensionRequest({ type: 'capture:event', event }),
    ).not.toBeNull();
  });

  it('rejects raw values, HTML, arbitrary metadata, and sentinel PII', () => {
    for (const unsafeEvent of [
      { ...event, rawValue: 'secret' },
      { ...event, elementLabel: '<input value="secret">' },
      { ...event, elementLabel: 'alex.person@example.com' },
      { ...event, elementLabel: '+1 (312) 555-0188' },
      { ...event, elementLabel: '4111 1111 1111 1111' },
      { ...event, elementRole: 'person@example.com' },
      { ...event, metadata: { unrestricted: true } },
    ]) {
      expect(
        parseExtensionRequest({ type: 'capture:event', event: unsafeEvent }),
      ).toBeNull();
    }
  });

  it('rejects malformed and oversized messages', () => {
    expect(parseExtensionRequest({ type: 'capture:event' })).toBeNull();
    expect(
      parseExtensionRequest({
        type: 'setup:join',
        inviteCode: 'x'.repeat(maximumIpcBytes + 1),
      }),
    ).toBeNull();
  });
});

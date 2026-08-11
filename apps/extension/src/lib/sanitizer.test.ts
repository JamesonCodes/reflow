import { describe, expect, it } from 'vitest';

import {
  classifyFiles,
  classifyInputValue,
  createOutOfScopeGap,
  createSanitizedEvent,
  sanitizeBoundedText,
  sanitizeInputElement,
  sentinelPiiValues,
} from './sanitizer';

describe('content-script sanitization', () => {
  it.each(sentinelPiiValues)('redacts sentinel PII: %s', (sentinel) => {
    expect(sanitizeBoundedText(`Account ${sentinel}`)).not.toContain(sentinel);
    expect(classifyInputValue(sentinel, 'text')).toMatch(/^\[[A-Z]/);
  });

  it('rejects a password before touching its value getter', () => {
    const password = {
      type: 'password',
      get value(): string {
        throw new Error('password value was read');
      },
    };
    expect(sanitizeInputElement(password)).toBeNull();
  });

  it('generalizes files without touching names, paths, contents, or bytes', () => {
    const file = {
      size: 250_000,
      type: 'application/pdf',
      get name(): string {
        throw new Error('filename was read');
      },
    };
    expect(classifyFiles([file])).toBe('[FILE:PDF_MEDIUM]');
  });

  it('uses field intent before generic numeric pattern matching', () => {
    expect(
      classifyInputValue('2840.00', 'text', {
        inputMode: 'decimal',
        label: 'Payment amount',
      }),
    ).toBe('[NUMBER:CURRENCY]');
    expect(classifyInputValue('2026-08-11', 'date')).toBe('[DATE]');
    expect(
      classifyInputValue('123-45-6789', 'text', {
        label: 'Tax identifier',
      }),
    ).toBe('[GOVERNMENT_ID]');
    expect(
      classifyInputValue('4111 1111 1111 1111', 'text', {
        label: 'Test account or card value',
      }),
    ).toBe('[PAYMENT_CARD]');
  });

  it('redacts record identifiers from bounded DOM text', () => {
    expect(sanitizeBoundedText('Open vendor ACME-42 for INV-1042')).toBe(
      'Open vendor [RECORD_ID] for [RECORD_ID]',
    );
  });

  it('removes query strings, fragments, and PII from captured URLs', () => {
    const event = createSanitizedEvent(
      'https://billing.example.test/users/alex.person@example.com?token=secret#card',
      { actionType: 'navigate' },
      new Date('2026-08-01T12:00:00.000Z'),
      '10000000-0000-4000-8000-000000000001',
    );
    expect(event).toMatchObject({
      hostname: 'billing.example.test',
      normalizedPath: '/users/:email',
    });
    expect(JSON.stringify(event)).not.toContain('token=secret');
    expect(JSON.stringify(event)).not.toContain('#card');
    expect(JSON.stringify(event)).not.toContain('alex.person@example.com');
  });

  it('creates anonymous out-of-scope gaps', () => {
    expect(
      createOutOfScopeGap(
        new Date('2026-08-01T12:00:00.000Z'),
        '10000000-0000-4000-8000-000000000001',
      ),
    ).toMatchObject({
      actionType: 'out_of_scope_gap',
      hostname: null,
      normalizedPath: null,
      elementLabel: null,
    });
  });
});

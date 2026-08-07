import { describe, expect, it } from 'vitest';

import { buildQueuedEvent, toDatabaseRow } from './queue';
import { createSanitizedEvent, sentinelPiiValues } from './sanitizer';

describe('sanitized delivery queue', () => {
  it('adds only service-worker identity and ordering to a sanitized event', () => {
    const event = createSanitizedEvent(
      'https://erp.example.test/invoices/new',
      {
        actionType: 'input',
        elementLabel: `Customer ${sentinelPiiValues[0]}`,
        semanticInputToken: '[EMAIL]',
      },
      new Date('2026-08-01T12:00:00.000Z'),
      '10000000-0000-4000-8000-000000000001',
    );
    const queued = buildQueuedEvent(event, {
      localTabId: 1,
      observationWindowId: '10000000-0000-4000-8000-000000000002',
      observerId: '10000000-0000-4000-8000-000000000003',
      sequenceNo: 1,
      workspaceId: '10000000-0000-4000-8000-000000000004',
    });
    const requestBody = toDatabaseRow({
      attempts: 0,
      event: queued,
      nextAttemptAt: 0,
    });
    const serialized = JSON.stringify({ queued, requestBody });

    for (const sentinel of sentinelPiiValues)
      expect(serialized).not.toContain(sentinel);
    expect(serialized).not.toContain('clientEventId');
    expect(serialized).not.toContain('rawValue');
    expect(requestBody).toMatchObject({ sequence_no: 1, tab_id: 1 });
  });
});

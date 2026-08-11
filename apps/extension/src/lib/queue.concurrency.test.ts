import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActiveObservationState, StoredQueueItem } from './model';
import { createSanitizedEvent } from './sanitizer';

const testState = vi.hoisted(() => ({
  deliveryError: null as string | null,
  observation: null as ActiveObservationState | null,
  queue: [] as StoredQueueItem[],
  upsertCalls: 0,
  upsertOptionsJson: '',
  upsertRowsCount: 0,
}));

vi.mock('./storage', () => ({
  getDeliveryError: vi.fn(() => Promise.resolve(testState.deliveryError)),
  getObservationState: vi.fn(() =>
    Promise.resolve(structuredClone(testState.observation)),
  ),
  getQueue: vi.fn(() => Promise.resolve(structuredClone(testState.queue))),
  setDeliveryError: vi.fn((error: string | null) => {
    testState.deliveryError = error;
    return Promise.resolve();
  }),
  setObservationState: vi.fn((state: ActiveObservationState) => {
    testState.observation = structuredClone(state);
    return Promise.resolve();
  }),
  setQueue: vi.fn((queue: StoredQueueItem[]) => {
    testState.queue = structuredClone(queue);
    return Promise.resolve();
  }),
}));

vi.mock('./supabase', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: vi.fn((rows: unknown[], options: unknown) => {
        testState.upsertCalls += 1;
        testState.upsertRowsCount = rows.length;
        testState.upsertOptionsJson = JSON.stringify(options);
        return Promise.resolve({ error: null });
      }),
    })),
  })),
}));

import {
  drainInterruptedQueue,
  enqueueCapturedEvent,
  enqueueTabScopeEvent,
  flushQueue,
  rawEventConflictTarget,
} from './queue';

const observationFixture: ActiveObservationState = {
  departmentId: '10000000-0000-4000-8000-000000000001',
  domains: [{ hostname: 'localhost', includeSubdomains: true }],
  exclusions: [],
  jobRoleId: '10000000-0000-4000-8000-000000000002',
  lastHostname: null,
  lastScope: null,
  nextSequence: 1,
  nextTabId: 1,
  observerId: '10000000-0000-4000-8000-000000000003',
  status: 'active',
  tabIds: {},
  windowId: '10000000-0000-4000-8000-000000000004',
  workspaceId: '10000000-0000-4000-8000-000000000005',
};

describe('serialized event sequencing', () => {
  beforeEach(() => {
    testState.deliveryError = null;
    testState.observation = structuredClone(observationFixture);
    testState.queue = [];
    testState.upsertCalls = 0;
    testState.upsertOptionsJson = '';
    testState.upsertRowsCount = 0;
  });

  it('allocates unique sequences when tab and DOM events arrive together', async () => {
    const url = 'http://ap.localhost:3100/invoices';
    const click = createSanitizedEvent(url, {
      actionType: 'click',
      elementLabel: 'Open invoice',
      elementRole: 'button',
    });

    await Promise.all([
      enqueueTabScopeEvent(1, url),
      enqueueCapturedEvent(click, 1, url),
      enqueueTabScopeEvent(2, 'http://erp.localhost:3100/orders'),
    ]);

    expect(testState.queue.map((item) => item.event.sequenceNo)).toEqual([
      1, 2, 3,
    ]);
    expect(
      new Set(testState.queue.map((item) => item.event.sequenceNo)).size,
    ).toBe(3);
    expect(testState.observation?.nextSequence).toBe(4);
  });

  it('treats the server sequence constraint as the delivery identity', async () => {
    const url = 'http://ap.localhost:3100/invoices';
    await enqueueCapturedEvent(
      createSanitizedEvent(url, {
        actionType: 'click',
        elementLabel: 'Open invoice',
        elementRole: 'button',
      }),
      1,
      url,
    );

    await flushQueue();

    expect(testState.upsertRowsCount).toBe(1);
    expect(testState.upsertOptionsJson).toBe(
      JSON.stringify({
        ignoreDuplicates: true,
        onConflict: rawEventConflictTarget,
      }),
    );
    expect(testState.queue).toEqual([]);
  });

  it('does not emit tab activation noise for same-domain URL updates', async () => {
    await enqueueTabScopeEvent(1, 'http://ap.localhost:3100/inbox');
    await enqueueTabScopeEvent(
      1,
      'http://ap.localhost:3100/invoices/INV-1042',
      'url_changed',
    );
    await enqueueTabScopeEvent(
      1,
      'http://erp.localhost:3100/vendors/ACME-42',
      'url_changed',
    );

    expect(testState.queue.map((item) => item.event.actionType)).toEqual([
      'tab_activate',
      'domain_transition',
    ]);
    expect(testState.queue[1]?.event.normalizedPath).toBe('/vendors/:id');
  });

  it('forces an interrupted queue past delivery backoff', async () => {
    const url = 'http://ap.localhost:3100/invoices';
    await enqueueCapturedEvent(
      createSanitizedEvent(url, {
        actionType: 'click',
        elementLabel: 'Open invoice',
        elementRole: 'button',
      }),
      1,
      url,
    );
    testState.queue[0]!.nextAttemptAt = Date.now() + 60_000;

    const result = await drainInterruptedQueue();

    expect(result).toEqual({
      drained: true,
      windowIds: [observationFixture.windowId],
    });
    expect(testState.upsertCalls).toBe(1);
    expect(testState.queue).toEqual([]);
  });
});

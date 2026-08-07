import {
  queuedCapturedEventSchema,
  sanitizedCapturedEventSchema,
  type SanitizedCapturedEvent,
} from '@reflow/contracts';

import { isObservableUrl, normalizeBrowserUrl } from './scope';
import {
  getDeliveryError,
  getObservationState,
  getQueue,
  setDeliveryError,
  setObservationState,
  setQueue,
} from './storage';
import { getSupabaseClient } from './supabase';

const maximumQueueSize = 5000;
const batchSize = 50;
let mutation = Promise.resolve();

export interface TrustedQueueContext {
  localTabId: number;
  observationWindowId: string;
  observerId: string;
  sequenceNo: number;
  workspaceId: string;
}

function serialize<T>(operation: () => Promise<T>) {
  const next = mutation.then(operation, operation);
  mutation = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function enqueueCapturedEvent(
  input: SanitizedCapturedEvent,
  chromeTabId: number,
  senderUrl: string,
) {
  return serialize(async () => {
    const parsed = sanitizedCapturedEventSchema.safeParse(input);
    if (!parsed.success) return false;
    const state = await getObservationState();
    if (!state || state.status !== 'active') return false;

    if (parsed.data.actionType !== 'out_of_scope_gap') {
      if (!isObservableUrl(senderUrl, state.domains, state.exclusions))
        return false;
      const senderLocation = normalizeBrowserUrl(senderUrl);
      if (
        senderLocation.hostname !== parsed.data.hostname ||
        senderLocation.normalizedPath !== parsed.data.normalizedPath
      )
        return false;
    }

    const tabKey = String(chromeTabId);
    const localTabId = state.tabIds[tabKey] ?? state.nextTabId;
    if (!(tabKey in state.tabIds)) {
      state.tabIds[tabKey] = localTabId;
      state.nextTabId += 1;
    }

    const queuedEvent = buildQueuedEvent(parsed.data, {
      localTabId,
      observationWindowId: state.windowId,
      observerId: state.observerId,
      sequenceNo: state.nextSequence,
      workspaceId: state.workspaceId,
    });
    state.nextSequence += 1;
    await setObservationState(state);

    const queue = await getQueue();
    queue.push({ attempts: 0, event: queuedEvent, nextAttemptAt: 0 });
    await setQueue(queue.slice(-maximumQueueSize));
    return true;
  });
}

export function buildQueuedEvent(
  event: SanitizedCapturedEvent,
  context: TrustedQueueContext,
) {
  const { clientEventId, ...sanitizedFields } = event;
  return queuedCapturedEventSchema.parse({
    ...sanitizedFields,
    id: clientEventId,
    observationWindowId: context.observationWindowId,
    observerId: context.observerId,
    sequenceNo: context.sequenceNo,
    tabId: context.localTabId,
    workspaceId: context.workspaceId,
  });
}

export function toDatabaseRow(
  item: Awaited<ReturnType<typeof getQueue>>[number],
) {
  const event = item.event;
  return {
    action_type: event.actionType,
    element_label: event.elementLabel,
    element_role: event.elementRole,
    hostname: event.hostname,
    id: event.id,
    normalized_path: event.normalizedPath,
    observation_window_id: event.observationWindowId,
    observer_id: event.observerId,
    occurred_at: event.occurredAt,
    page_landmark: event.pageLandmark,
    semantic_input_token: event.semanticInputToken,
    sequence_no: event.sequenceNo,
    tab_id: event.tabId,
    workspace_id: event.workspaceId,
  };
}

export function flushQueue() {
  return serialize(async () => {
    const queue = await getQueue();
    const now = Date.now();
    const due = queue
      .filter((item) => item.nextAttemptAt <= now)
      .slice(0, batchSize);
    if (due.length === 0) return 0;

    const { error } = await getSupabaseClient()
      .from('raw_event_tokens')
      .upsert(due.map(toDatabaseRow), {
        ignoreDuplicates: true,
        onConflict: 'id',
      });
    const dueIds = new Set(due.map((item) => item.event.id));
    if (!error) {
      await setQueue(queue.filter((item) => !dueIds.has(item.event.id)));
      await setDeliveryError(null);
      return due.length;
    }

    const retried = queue.map((item) => {
      if (!dueIds.has(item.event.id)) return item;
      const attempts = item.attempts + 1;
      return {
        ...item,
        attempts,
        nextAttemptAt: now + Math.min(60_000, 2 ** attempts * 1000),
      };
    });
    await setQueue(retried);
    await setDeliveryError('delivery_failed');
    return 0;
  });
}

export async function queueStatus() {
  return {
    deliveryError: await getDeliveryError(),
    queueSize: (await getQueue()).length,
  };
}

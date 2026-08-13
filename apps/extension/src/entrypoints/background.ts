import { browser, type Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

import { parseExtensionRequest } from '../lib/messages';
import { DocumentNavigationGate } from '../lib/document-navigation';
import { selectPageContextTab } from '../lib/page-context';
import { createSanitizedEvent } from '../lib/sanitizer';
import type {
  ActiveObservationState,
  ExtensionResponse,
  ObserverDefaults,
  PopupSnapshot,
} from '../lib/model';
import {
  drainInterruptedQueue,
  drainQueueAndRun,
  enqueueCapturedEvent,
  enqueueTabScopeEvent,
  flushQueue,
  queueStatus,
} from '../lib/queue';
import { domainPermissionPatterns, isObservableUrl } from '../lib/scope';
import {
  clearObservationState,
  getOpenObservationWindowId,
  getObservationState,
  setOpenObservationWindowId,
  setObservationState,
} from '../lib/storage';
import {
  joinStudy,
  loadStudySetup,
  saveObserverDefaults,
  startObservation,
  transitionObservation,
} from '../lib/supabase';

const observerScriptId = 'reflow-observer';
const observerScriptFile = '/content-scripts/observer.js' as const;
const retryAlarmName = 'reflow-delivery-retry';
const documentNavigationGate = new DocumentNavigationGate();

function configuration(state: ActiveObservationState | null) {
  return {
    active: state?.status === 'active',
    domains: state?.domains ?? [],
    exclusions: state?.exclusions ?? [],
  };
}

async function setBadge(status: 'active' | 'paused' | 'off') {
  await browser.action.setBadgeText({
    text: status === 'active' ? 'REC' : status === 'paused' ? 'II' : '',
  });
  if (status !== 'off') {
    await browser.action.setBadgeBackgroundColor({
      color: status === 'active' ? '#dc3f4f' : '#c18b22',
    });
  }
}

async function unregisterObserverScript() {
  try {
    await browser.scripting.unregisterContentScripts({
      ids: [observerScriptId],
    });
  } catch {
    // An absent runtime registration is already the desired state.
  }
}

function permissionPatterns(state: ActiveObservationState) {
  return [...new Set(state.domains.flatMap(domainPermissionPatterns))];
}

async function notifyContentScripts(state: ActiveObservationState | null) {
  const tabs = await browser.tabs.query({});
  await Promise.allSettled(
    tabs.map(async (tab) => {
      if (!tab.id || tab.incognito || !tab.url?.startsWith('http')) return;
      await browser.tabs.sendMessage(tab.id, {
        configuration: configuration(state),
        type: 'recording:configuration',
      });
    }),
  );
}

async function registerObserverScript(state: ActiveObservationState) {
  const matches = permissionPatterns(state);
  if (matches.length === 0) throw new Error('approved_domains_required');
  const hasPermissions = await browser.permissions.contains({
    origins: matches,
  });
  if (!hasPermissions) throw new Error('host_permission_required');

  await unregisterObserverScript();
  await browser.scripting.registerContentScripts([
    {
      id: observerScriptId,
      js: [observerScriptFile],
      matches,
      persistAcrossSessions: false,
      runAt: 'document_start',
    },
  ]);

  const tabs = await browser.tabs.query({});
  documentNavigationGate.reset(
    tabs
      .filter(
        (tab) =>
          typeof tab.id === 'number' &&
          !tab.incognito &&
          tab.url &&
          isObservableUrl(tab.url, state.domains, state.exclusions),
      )
      .map((tab) => tab.id as number),
  );
  await Promise.allSettled(
    tabs.map(async (tab) => {
      if (
        !tab.id ||
        tab.incognito ||
        !tab.url ||
        !isObservableUrl(tab.url, state.domains, state.exclusions)
      )
        return;
      await browser.scripting.executeScript({
        files: [observerScriptFile],
        target: { tabId: tab.id },
      });
    }),
  );
  await notifyContentScripts(state);
}

async function captureActivePageContext(state: ActiveObservationState) {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = selectPageContextTab(tabs, state);
  if (!tab?.id) return;
  await browser.tabs
    .sendMessage(tab.id, { type: 'recording:capture-context' })
    .catch(() => undefined);
}

async function popupSnapshot(): Promise<PopupSnapshot> {
  const [setup, state, delivery] = await Promise.all([
    loadStudySetup(),
    getObservationState(),
    queueStatus(),
  ]);
  return {
    ...setup,
    ...delivery,
    recording: state
      ? {
          departmentId: state.departmentId,
          jobRoleId: state.jobRoleId,
          status: state.status,
          windowId: state.windowId,
        }
      : null,
  };
}

function defaultsFromRequest(request: {
  customRole: string | null;
  departmentId: string;
  jobRoleId: string | null;
}): ObserverDefaults {
  if ((request.jobRoleId === null) === (request.customRole === null))
    throw new Error('exactly_one_role_required');
  return {
    customRole: request.customRole,
    departmentId: request.departmentId,
    jobRoleId: request.jobRoleId,
  };
}

async function startRecording(defaults: ObserverDefaults) {
  const activeTabs = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  const activeTab = activeTabs[0];
  if (!activeTab?.url || activeTab.incognito)
    throw new Error('approved_active_tab_required');

  const state = await startObservation(defaults);
  if (!isObservableUrl(activeTab.url, state.domains, state.exclusions)) {
    await transitionObservation(state.windowId, 'cancelled');
    throw new Error('approved_active_tab_required');
  }
  try {
    await setOpenObservationWindowId(state.windowId);
    await setObservationState(state);
    await registerObserverScript(state);
    await captureActivePageContext(state);
    await setBadge('active');
  } catch (error) {
    await clearObservationState();
    await setOpenObservationWindowId(null);
    await transitionObservation(state.windowId, 'cancelled');
    throw error;
  }
}

async function transitionRecording(status: 'active' | 'paused' | 'completed') {
  const state = await getObservationState();
  if (!state) throw new Error('observation_not_active');

  if (status !== 'active') {
    // Block new sequence allocation while draining and closing the server-side
    // window. Events cannot race into the queue after the final flush.
    const drained = await drainQueueAndRun(async () => {
      await transitionObservation(state.windowId, status);
      if (status === 'completed') {
        await clearObservationState();
        await setOpenObservationWindowId(null);
      } else {
        state.status = status;
        await setObservationState(state);
      }
    });
    if (!drained) throw new Error('events_pending_delivery');
  } else {
    await transitionObservation(state.windowId, status);
    state.status = status;
    await setObservationState(state);
  }

  if (status === 'completed') {
    documentNavigationGate.reset();
    await unregisterObserverScript();
    await notifyContentScripts(null);
    await setBadge('off');
    return;
  }

  if (status === 'active') {
    await registerObserverScript(state);
    await captureActivePageContext(state);
  }
  await notifyContentScripts(state);
  await setBadge(status);
}

async function closeInterruptedObservation() {
  const state = await getObservationState();
  const markerWindowId = await getOpenObservationWindowId();

  // Browser or extension restarts must never silently resume recording. Stop
  // capture first, then deliver only the already-sanitized local queue.
  await unregisterObserverScript();
  await clearObservationState();
  await notifyContentScripts(null);
  await setBadge('off');

  const result = await drainInterruptedQueue();
  const windowIds = [
    ...new Set(
      [state?.windowId, markerWindowId, ...result.windowIds].filter(
        (windowId): windowId is string => Boolean(windowId),
      ),
    ),
  ];
  if (!result.drained) {
    await setOpenObservationWindowId(windowIds[0] ?? null);
    return;
  }

  try {
    await Promise.all(
      windowIds.map((windowId) => transitionObservation(windowId, 'completed')),
    );
    await setOpenObservationWindowId(null);
  } catch {
    // Keep the durable marker so the retry alarm can finish the close later.
  }
}

async function retryDeliveryOrRecovery() {
  if (await getObservationState()) await flushQueue();
  else if (await getOpenObservationWindowId())
    await closeInterruptedObservation();
  else await flushQueue();
}

async function recordTabScope(
  tabId: number,
  trigger: 'activated' | 'url_changed',
) {
  const tab = await browser.tabs.get(tabId);
  if (tab.incognito || !tab.url) return;
  if (trigger === 'url_changed' && !tab.active) return;
  await enqueueTabScopeEvent(tabId, tab.url, trigger);
  await flushQueue();
}

async function handleRequest(
  rawRequest: unknown,
  sender: Browser.runtime.MessageSender,
): Promise<ExtensionResponse<unknown>> {
  const request = parseExtensionRequest(rawRequest);
  if (!request) return { ok: false, error: 'invalid_message' };

  try {
    switch (request.type) {
      case 'setup:get':
        return { ok: true, data: await popupSnapshot() };
      case 'setup:join':
        await joinStudy(request.inviteCode);
        return { ok: true, data: await popupSnapshot() };
      case 'setup:save-defaults':
        await saveObserverDefaults(defaultsFromRequest(request));
        return { ok: true, data: await popupSnapshot() };
      case 'recording:start':
        await startRecording(defaultsFromRequest(request));
        return { ok: true, data: await popupSnapshot() };
      case 'recording:pause':
        await transitionRecording('paused');
        return { ok: true, data: await popupSnapshot() };
      case 'recording:resume':
        await transitionRecording('active');
        return { ok: true, data: await popupSnapshot() };
      case 'recording:stop':
        await transitionRecording('completed');
        return { ok: true, data: await popupSnapshot() };
      case 'content:get-config': {
        if (!sender.tab || sender.tab.incognito)
          return { ok: false, error: 'content_sender_required' };
        return {
          ok: true,
          data: configuration(await getObservationState()),
        };
      }
      case 'capture:document-ready': {
        if (!sender.tab?.id || sender.tab.incognito || !sender.tab.url)
          return { ok: false, error: 'content_sender_required' };
        if (!documentNavigationGate.shouldCapture(sender.tab.id))
          return { ok: true, data: undefined };
        const accepted = await enqueueCapturedEvent(
          createSanitizedEvent(sender.tab.url, { actionType: 'navigate' }),
          sender.tab.id,
          sender.tab.url,
        );
        if (accepted) await flushQueue();
        return accepted
          ? { ok: true, data: undefined }
          : { ok: false, error: 'event_rejected' };
      }
      case 'capture:event': {
        if (!sender.tab?.id || sender.tab.incognito || !sender.tab.url)
          return { ok: false, error: 'content_sender_required' };
        const accepted = await enqueueCapturedEvent(
          request.event,
          sender.tab.id,
          sender.tab.url,
        );
        if (accepted) await flushQueue();
        return accepted
          ? { ok: true, data: undefined }
          : { ok: false, error: 'event_rejected' };
      }
    }
    return { ok: false, error: 'invalid_message' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'operation_failed',
    };
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void handleRequest(message, sender).then(sendResponse);
    return true;
  });
  browser.tabs.onActivated.addListener(({ tabId }) => {
    void recordTabScope(tabId, 'activated');
  });
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) void recordTabScope(tabId, 'url_changed');
  });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === retryAlarmName) void retryDeliveryOrRecovery();
  });
  browser.runtime.onStartup.addListener(() => {
    void closeInterruptedObservation();
  });
  browser.runtime.onInstalled.addListener(() => {
    void closeInterruptedObservation();
  });
  void browser.alarms.create(retryAlarmName, { periodInMinutes: 1 });
  void flushQueue();
});

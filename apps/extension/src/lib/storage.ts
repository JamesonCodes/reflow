import { browser } from 'wxt/browser';

import type { ActiveObservationState, StoredQueueItem } from './model';

const installationKey = 'reflow.installation-id';
const observationKey = 'reflow.active-observation';
const queueKey = 'reflow.sanitized-queue';
const deliveryErrorKey = 'reflow.delivery-error';

export const supabaseAuthStorage = {
  async getItem(key: string) {
    const result = await browser.storage.local.get(key);
    return typeof result[key] === 'string' ? result[key] : null;
  },
  async removeItem(key: string) {
    await browser.storage.local.remove(key);
  },
  async setItem(key: string, value: string) {
    await browser.storage.local.set({ [key]: value });
  },
};

export async function getInstallationId() {
  const result = await browser.storage.local.get(installationKey);
  if (typeof result[installationKey] === 'string')
    return result[installationKey];
  const installationId = crypto.randomUUID();
  await browser.storage.local.set({ [installationKey]: installationId });
  return installationId;
}

export async function getObservationState() {
  const result = await browser.storage.session.get(observationKey);
  return (result[observationKey] as ActiveObservationState | undefined) ?? null;
}

export async function setObservationState(state: ActiveObservationState) {
  await browser.storage.session.set({ [observationKey]: state });
}

export async function clearObservationState() {
  await browser.storage.session.remove(observationKey);
}

export async function getQueue() {
  const result = await browser.storage.local.get(queueKey);
  return (result[queueKey] as StoredQueueItem[] | undefined) ?? [];
}

export async function setQueue(queue: StoredQueueItem[]) {
  await browser.storage.local.set({ [queueKey]: queue });
}

export async function getDeliveryError() {
  const result = await browser.storage.local.get(deliveryErrorKey);
  return typeof result[deliveryErrorKey] === 'string'
    ? result[deliveryErrorKey]
    : null;
}

export async function setDeliveryError(errorCode: string | null) {
  if (errorCode) {
    await browser.storage.local.set({ [deliveryErrorKey]: errorCode });
  } else {
    await browser.storage.local.remove(deliveryErrorKey);
  }
}

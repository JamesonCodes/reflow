import { sanitizedCapturedEventSchema } from '@reflow/contracts';
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';

import { captureDomEvent } from '../lib/dom-capture';
import type { ActiveObservationState } from '../lib/model';
import { NavigationTracker } from '../lib/navigation';
import { createSanitizedEvent } from '../lib/sanitizer';
import { isObservableUrl } from '../lib/scope';

interface ContentConfiguration {
  active: boolean;
  domains: ActiveObservationState['domains'];
  exclusions: ActiveObservationState['exclusions'];
}

declare global {
  var __REFLOW_OBSERVER_INSTALLED__: boolean | undefined;
}

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  noScriptStartedPostMessage: true,
  registration: 'runtime',
  runAt: 'document_start',
  main(ctx) {
    if (globalThis.__REFLOW_OBSERVER_INSTALLED__) return;
    globalThis.__REFLOW_OBSERVER_INSTALLED__ = true;

    let configuration: ContentConfiguration = {
      active: false,
      domains: [],
      exclusions: [],
    };
    const navigation = new NavigationTracker(window.location.href);

    function mayCapture() {
      return (
        configuration.active &&
        isObservableUrl(
          window.location.href,
          configuration.domains,
          configuration.exclusions,
        )
      );
    }

    function send(event: unknown) {
      if (!mayCapture()) return;
      const parsed = sanitizedCapturedEventSchema.safeParse(event);
      if (!parsed.success) return;
      void browser.runtime
        .sendMessage({ type: 'capture:event', event: parsed.data })
        .catch(() => undefined);
    }

    function sendNavigation(
      actionType: ReturnType<NavigationTracker['observe']>,
    ) {
      if (!actionType || !mayCapture()) return;
      send(createSanitizedEvent(window.location.href, { actionType }));
    }

    function handleDomEvent(event: Event) {
      // Scope is checked before any DOM value or text is inspected.
      if (!mayCapture()) return;
      const captured = captureDomEvent(event);
      if (captured) send(captured);
    }

    ctx.addEventListener(document, 'click', handleDomEvent, true);
    ctx.addEventListener(document, 'change', handleDomEvent, true);
    ctx.addEventListener(document, 'submit', handleDomEvent, true);
    ctx.addEventListener(document, 'invalid', handleDomEvent, true);
    ctx.addEventListener(window, 'hashchange', () => {
      sendNavigation(navigation.observe(window.location.href));
    });
    ctx.addEventListener(window, 'popstate', () => {
      sendNavigation(navigation.observe(window.location.href));
    });
    ctx.setInterval(() => {
      sendNavigation(navigation.observe(window.location.href));
    }, 500);

    browser.runtime.onMessage.addListener((message: unknown) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'recording:configuration'
      ) {
        const candidate = message as {
          configuration?: ContentConfiguration;
        };
        if (candidate.configuration) configuration = candidate.configuration;
      }
      return undefined;
    });

    void browser.runtime
      .sendMessage({ type: 'content:get-config' })
      .then((response: unknown) => {
        if (
          typeof response === 'object' &&
          response !== null &&
          'ok' in response &&
          response.ok === true &&
          'data' in response
        ) {
          configuration = response.data as ContentConfiguration;
          if (mayCapture()) {
            send(
              createSanitizedEvent(window.location.href, {
                actionType: navigation.initial(),
              }),
            );
          }
        }
      })
      .catch(() => undefined);
  },
});

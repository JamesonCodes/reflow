import type { SanitizedCapturedEvent } from '@reflow/contracts';

import {
  classifyDownload,
  classifyFiles,
  classifyInputValue,
  createSanitizedEvent,
  sanitizeBoundedText,
  sanitizeInputElement,
} from './sanitizer';

function interactiveElement(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest(
    'a,button,input,select,textarea,[contenteditable="true"],[role="button"],[role="link"],[role="menuitem"],[role="checkbox"],[role="radio"],[role="tab"]',
  );
}

function elementRole(element: Element) {
  const explicitRole = element.getAttribute('role');
  if (explicitRole) return explicitRole.slice(0, 64);
  if (element instanceof HTMLAnchorElement) return 'link';
  if (element instanceof HTMLButtonElement) return 'button';
  if (element instanceof HTMLSelectElement) return 'combobox';
  if (element instanceof HTMLTextAreaElement) return 'textbox';
  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox') return 'checkbox';
    if (element.type === 'radio') return 'radio';
    if (element.type === 'submit' || element.type === 'button') return 'button';
    return 'textbox';
  }
  if (element.getAttribute('contenteditable') === 'true') return 'textbox';
  return element.tagName.toLowerCase().slice(0, 64);
}

function associatedLabel(element: Element) {
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return sanitizeBoundedText(ariaLabel);
  if (
    (element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement) &&
    element.labels?.[0]
  ) {
    const label = element.labels[0];
    const controlText = element.textContent?.trim() ?? '';
    const fullLabelText = label.textContent ?? '';
    if (controlText) {
      const controlOffset = fullLabelText.indexOf(controlText);
      if (controlOffset >= 0)
        return sanitizeBoundedText(fullLabelText.slice(0, controlOffset));
    }
    let textBeforeControl = '';
    for (const child of label.childNodes) {
      if (
        child === element ||
        (child instanceof Element && child.contains(element))
      )
        break;
      textBeforeControl += ` ${child.textContent ?? ''}`;
    }
    return sanitizeBoundedText(textBeforeControl) ?? null;
  }
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const label = document.getElementById(labelledBy.split(/\s+/)[0] ?? '');
    if (label) return sanitizeBoundedText(label.textContent);
  }
  if (element instanceof HTMLInputElement) {
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) return sanitizeBoundedText(placeholder);
  }
  // Textareas, selects, and editable regions can expose the user's value via
  // textContent. Their visible content is never treated as a label.
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement ||
    element.getAttribute('contenteditable') === 'true'
  )
    return null;
  return sanitizeBoundedText(element.textContent);
}

function pageLandmark(element: Element) {
  const landmark = element.closest(
    'main,nav,aside,header,footer,section,form,[role="main"],[role="navigation"],[role="region"],[aria-label]',
  );
  if (!landmark) return null;
  return (
    sanitizeBoundedText(landmark.getAttribute('aria-label')) ??
    landmark.getAttribute('role') ??
    landmark.tagName.toLowerCase()
  );
}

function inputEvent(
  element: Element,
  rawUrl: string,
): SanitizedCapturedEvent | null {
  if (element instanceof HTMLInputElement) {
    if (element.type.toLowerCase() === 'password') return null;
    if (element.type.toLowerCase() === 'file') {
      const files = Array.from(element.files ?? [], (file) => ({
        size: file.size,
        type: file.type,
      }));
      return createSanitizedEvent(rawUrl, {
        actionType: 'file_upload',
        elementLabel: associatedLabel(element),
        elementRole: 'textbox',
        pageLandmark: pageLandmark(element),
        semanticInputToken: classifyFiles(files),
      });
    }
    const label = associatedLabel(element);
    const semanticInputToken = sanitizeInputElement(element, {
      label,
    });
    if (!semanticInputToken) return null;
    return createSanitizedEvent(rawUrl, {
      actionType: 'input',
      elementLabel: label,
      elementRole: elementRole(element),
      pageLandmark: pageLandmark(element),
      semanticInputToken,
    });
  }
  if (element instanceof HTMLSelectElement) {
    return createSanitizedEvent(rawUrl, {
      actionType: 'input',
      elementLabel: associatedLabel(element),
      elementRole: 'combobox',
      pageLandmark: pageLandmark(element),
      semanticInputToken: '[SELECTION]',
    });
  }
  if (element instanceof HTMLTextAreaElement) {
    return createSanitizedEvent(rawUrl, {
      actionType: 'input',
      elementLabel: associatedLabel(element),
      elementRole: 'textbox',
      pageLandmark: pageLandmark(element),
      semanticInputToken: classifyInputValue(element.value, 'text'),
    });
  }
  if (element.getAttribute('contenteditable') === 'true') {
    return createSanitizedEvent(rawUrl, {
      actionType: 'input',
      // The editable text is the input value, not a safe element label.
      elementLabel: sanitizeBoundedText(element.getAttribute('aria-label')),
      elementRole: 'textbox',
      pageLandmark: pageLandmark(element),
      semanticInputToken: classifyInputValue(element.textContent ?? '', 'text'),
    });
  }
  return null;
}

export function captureDomEvent(
  event: Event,
  rawUrl = window.location.href,
): SanitizedCapturedEvent | null {
  if (event.type === 'submit') {
    if (!(event.target instanceof HTMLFormElement)) return null;
    return createSanitizedEvent(rawUrl, {
      actionType: 'submit',
      elementLabel: sanitizeBoundedText(
        event.target.getAttribute('aria-label'),
      ),
      elementRole: 'form',
      pageLandmark: pageLandmark(event.target),
    });
  }

  const element = interactiveElement(event.target);
  if (!element) return null;
  if (event.type === 'change') return inputEvent(element, rawUrl);
  if (event.type === 'invalid') {
    if (element instanceof HTMLInputElement && element.type === 'password')
      return null;
    return createSanitizedEvent(rawUrl, {
      actionType: 'input',
      elementLabel: associatedLabel(element),
      elementRole: elementRole(element),
      pageLandmark: pageLandmark(element),
      semanticInputToken: '[ERROR:VALIDATION]',
    });
  }
  if (event.type !== 'click') return null;

  const anchor = element.closest('a');
  if (
    anchor instanceof HTMLAnchorElement &&
    (anchor.hasAttribute('download') ||
      /\.(?:csv|docx?|gif|jpe?g|md|odt|pdf|png|txt|xlsx?)(?:$|[?#])/i.test(
        anchor.href,
      ))
  ) {
    return createSanitizedEvent(rawUrl, {
      actionType: 'file_download',
      // Link text commonly repeats a filename, so it is intentionally omitted.
      elementLabel: null,
      elementRole: 'link',
      pageLandmark: pageLandmark(anchor),
      semanticInputToken: classifyDownload(anchor.href),
    });
  }

  return createSanitizedEvent(rawUrl, {
    actionType: 'click',
    elementLabel: associatedLabel(element),
    elementRole: elementRole(element),
    pageLandmark: pageLandmark(element),
  });
}

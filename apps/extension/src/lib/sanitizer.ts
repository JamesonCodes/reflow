import type {
  CapturedActionType,
  SanitizedCapturedEvent,
} from '@reflow/contracts';

import { normalizeBrowserUrl } from './scope';

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phonePattern = /(?:\+?\d[\d ().-]{5,}\d)/g;
const paymentCardPattern = /(?:\d[ -]?){13,19}/g;
const governmentIdPattern = /\b\d{3}-?\d{2}-?\d{4}\b/g;
const urlPattern = /https?:\/\/\S+/gi;

export const sentinelPiiValues = [
  'alex.person@example.com',
  '+1 (312) 555-0188',
  '4111 1111 1111 1111',
  '123-45-6789',
] as const;

export function sanitizeBoundedText(rawText: string | null | undefined) {
  if (!rawText) return null;
  const sanitized = rawText
    .replace(urlPattern, '[URL]')
    .replace(emailPattern, '[EMAIL]')
    .replace(governmentIdPattern, '[GOVERNMENT_ID]')
    .replace(paymentCardPattern, '[PAYMENT_CARD]')
    .replace(phonePattern, '[PHONE]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  return sanitized || null;
}

export function classifyInputValue(
  value: string,
  inputType: string,
): string | null {
  if (!value) return '[EMPTY]';
  if (
    inputType === 'email' ||
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)
  )
    return '[EMAIL]';
  if (inputType === 'tel' || /(?:\+?\d[\d ().-]{5,}\d)/.test(value))
    return '[PHONE]';
  if (/(?:\d[ -]?){13,19}/.test(value)) return '[PAYMENT_CARD]';
  if (/\b\d{3}-?\d{2}-?\d{4}\b/.test(value)) return '[GOVERNMENT_ID]';
  if (inputType === 'date' || inputType === 'datetime-local') return '[DATE]';
  if (inputType === 'number' || /^[-+]?\d+(?:[.,]\d+)?$/.test(value))
    return '[NUMBER]';
  if (/[$€£¥]\s*\d/.test(value)) return '[NUMBER:CURRENCY]';
  if (inputType === 'checkbox' || inputType === 'radio') return '[BOOLEAN]';
  if (value.length <= 40) return '[TEXT:SHORT]';
  if (value.length <= 200) return '[TEXT:MEDIUM]';
  return '[TEXT:LONG]';
}

export interface InputElementLike {
  type: string;
  value: string;
}

export function sanitizeInputElement(element: InputElementLike) {
  const normalizedType = element.type.toLowerCase();
  // This branch must execute before the value getter is touched.
  if (normalizedType === 'password') return null;
  return classifyInputValue(element.value, normalizedType);
}

export interface GeneralizedFile {
  size: number;
  type: string;
}

function fileCategory(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized === 'application/pdf') return 'PDF';
  if (normalized.includes('spreadsheet') || normalized.includes('excel'))
    return 'SPREADSHEET';
  if (normalized.includes('word') || normalized.includes('document'))
    return 'DOCUMENT';
  if (normalized.startsWith('image/')) return 'IMAGE';
  if (normalized.startsWith('text/')) return 'TEXT';
  return 'OTHER';
}

function fileSizeCategory(size: number) {
  if (size < 100_000) return 'SMALL';
  if (size < 5_000_000) return 'MEDIUM';
  return 'LARGE';
}

export function classifyFiles(files: readonly GeneralizedFile[]) {
  if (files.length === 0) return '[FILE:NONE]';
  if (files.length > 1) return '[FILE:MULTIPLE]';
  const file = files[0]!;
  return `[FILE:${fileCategory(file.type)}_${fileSizeCategory(file.size)}]`;
}

export function classifyDownload(rawUrl: string) {
  let extension = '';
  try {
    const pathname = new URL(rawUrl).pathname.toLowerCase();
    extension = pathname.split('.').pop() ?? '';
  } catch {
    return '[FILE:OTHER]';
  }
  if (extension === 'pdf') return '[FILE:PDF]';
  if (['csv', 'xls', 'xlsx'].includes(extension)) return '[FILE:SPREADSHEET]';
  if (['doc', 'docx', 'odt'].includes(extension)) return '[FILE:DOCUMENT]';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension))
    return '[FILE:IMAGE]';
  if (['txt', 'md'].includes(extension)) return '[FILE:TEXT]';
  return '[FILE:OTHER]';
}

export function classifyError(error: unknown) {
  if (error instanceof DOMException && error.name === 'NetworkError')
    return '[ERROR:NETWORK]';
  if (error instanceof TypeError) return '[ERROR:TYPE]';
  return '[ERROR:UNKNOWN]';
}

export interface SanitizedEventDetails {
  actionType: CapturedActionType;
  elementLabel?: string | null;
  elementRole?: string | null;
  pageLandmark?: string | null;
  semanticInputToken?: string | null;
}

export function createSanitizedEvent(
  rawUrl: string,
  details: SanitizedEventDetails,
  now = new Date(),
  id = crypto.randomUUID(),
): SanitizedCapturedEvent {
  const location = normalizeBrowserUrl(rawUrl);
  const rawRole = details.elementRole?.toLowerCase().slice(0, 64) ?? null;
  const elementRole =
    rawRole && /^[a-z][a-z0-9_-]*$/.test(rawRole) ? rawRole : null;
  return {
    clientEventId: id,
    actionType: details.actionType,
    hostname: location.hostname,
    normalizedPath: location.normalizedPath,
    elementRole,
    elementLabel: sanitizeBoundedText(details.elementLabel),
    pageLandmark: sanitizeBoundedText(details.pageLandmark),
    semanticInputToken: details.semanticInputToken ?? null,
    occurredAt: now.toISOString(),
  };
}

export function createOutOfScopeGap(
  now = new Date(),
  id = crypto.randomUUID(),
): SanitizedCapturedEvent {
  return {
    clientEventId: id,
    actionType: 'out_of_scope_gap',
    hostname: null,
    normalizedPath: null,
    elementRole: null,
    elementLabel: null,
    pageLandmark: null,
    semanticInputToken: null,
    occurredAt: now.toISOString(),
  };
}

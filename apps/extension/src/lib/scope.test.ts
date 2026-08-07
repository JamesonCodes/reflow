import { describe, expect, it } from 'vitest';

import {
  domainPermissionPatterns,
  isObservableUrl,
  normalizeBrowserUrl,
  pathIsExcluded,
} from './scope';

const domains = [
  { hostname: 'example.test', includeSubdomains: true },
  { hostname: 'exact.test', includeSubdomains: false },
];
const exclusions = [
  {
    hostname: 'example.test',
    includeSubdomains: true,
    pathPrefix: '/private',
  },
];

describe('approved browser scope', () => {
  it('allows exact and configured subdomains only', () => {
    expect(isObservableUrl('https://app.example.test/work', domains, [])).toBe(
      true,
    );
    expect(isObservableUrl('https://example.test/work', domains, [])).toBe(
      true,
    );
    expect(isObservableUrl('https://sub.exact.test/work', domains, [])).toBe(
      false,
    );
    expect(
      isObservableUrl('https://attacker-example.test/work', domains, []),
    ).toBe(false);
    expect(isObservableUrl('chrome://extensions', domains, [])).toBe(false);
  });

  it('enforces privacy exclusions on path boundaries', () => {
    expect(
      isObservableUrl('https://app.example.test/private', domains, exclusions),
    ).toBe(false);
    expect(
      isObservableUrl(
        'https://app.example.test/private/payroll',
        domains,
        exclusions,
      ),
    ).toBe(false);
    expect(
      isObservableUrl(
        'https://app.example.test/privateer',
        domains,
        exclusions,
      ),
    ).toBe(true);
    expect(pathIsExcluded('/privateer', '/private')).toBe(false);
  });

  it('generates permissions for the exact approved scope', () => {
    expect(domainPermissionPatterns(domains[0]!)).toEqual([
      'http://example.test/*',
      'https://example.test/*',
      'http://*.example.test/*',
      'https://*.example.test/*',
    ]);
  });

  it('normalizes identifiers and strips URL extras', () => {
    expect(
      normalizeBrowserUrl(
        'https://APP.example.test/orders/123456?customer=private#details',
      ),
    ).toEqual({ hostname: 'app.example.test', normalizedPath: '/orders/:id' });
  });
});

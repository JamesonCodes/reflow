import { describe, expect, it } from 'vitest';

import { NavigationTracker } from './navigation';

describe('browser navigation fixtures', () => {
  it('records each traditional page load as a full navigation', () => {
    expect(
      new NavigationTracker('https://erp.example.test/invoices').initial(),
    ).toBe('navigate');
    expect(
      new NavigationTracker('https://erp.example.test/vendors').initial(),
    ).toBe('navigate');
  });

  it('distinguishes SPA routes and hash transitions', () => {
    const tracker = new NavigationTracker('https://erp.example.test/invoices');
    expect(tracker.observe('https://erp.example.test/invoices')).toBeNull();
    expect(tracker.observe('https://erp.example.test/invoices#approval')).toBe(
      'hash_navigate',
    );
    expect(tracker.observe('https://erp.example.test/vendors/42')).toBe(
      'spa_navigate',
    );
  });
});

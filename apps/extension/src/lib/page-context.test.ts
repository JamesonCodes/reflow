import { describe, expect, it } from 'vitest';

import { selectPageContextTab } from './page-context';

const state = {
  domains: [{ hostname: 'ap.localhost', includeSubdomains: false }],
  exclusions: [],
};

describe('observation page context selection', () => {
  it('selects only the active approved non-incognito tab', () => {
    const selected = selectPageContextTab(
      [
        {
          active: false,
          id: 1,
          incognito: false,
          url: 'http://ap.localhost/inbox',
        },
        {
          active: true,
          id: 2,
          incognito: false,
          url: 'http://other.localhost/private',
        },
        {
          active: true,
          id: 3,
          incognito: true,
          url: 'http://ap.localhost/private',
        },
        {
          active: true,
          id: 4,
          incognito: false,
          url: 'http://ap.localhost/invoices/42',
        },
      ],
      state,
    );
    expect(selected?.id).toBe(4);
  });
});

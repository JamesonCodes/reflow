import { describe, expect, it } from 'vitest';

import {
  approvedHostnameSchema,
  observerDefaultsSchema,
  privacyPathPrefixSchema,
} from './study';

const defaults = {
  workspaceId: '10000000-0000-4000-8000-000000000001',
  observerId: '10000000-0000-4000-8000-000000000002',
  departmentId: '10000000-0000-4000-8000-000000000003',
  jobRoleId: '10000000-0000-4000-8000-000000000004',
  customRole: null,
};

describe('study setup contracts', () => {
  it('normalizes approved hostnames without accepting URLs', () => {
    expect(approvedHostnameSchema.parse(' Billing.Example.COM ')).toBe(
      'billing.example.com',
    );
    expect(
      approvedHostnameSchema.safeParse('https://example.com').success,
    ).toBe(false);
  });

  it('accepts only path prefixes without queries or fragments', () => {
    expect(privacyPathPrefixSchema.parse(' /payroll ')).toBe('/payroll');
    expect(privacyPathPrefixSchema.safeParse('/payroll?id=1').success).toBe(
      false,
    );
  });

  it('requires a department and exactly one role source', () => {
    expect(observerDefaultsSchema.safeParse(defaults).success).toBe(true);
    expect(
      observerDefaultsSchema.safeParse({
        ...defaults,
        departmentId: '',
      }).success,
    ).toBe(false);
    expect(
      observerDefaultsSchema.safeParse({
        ...defaults,
        customRole: 'Invoice analyst',
      }).success,
    ).toBe(false);
  });
});

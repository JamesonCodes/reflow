import { describe, expect, it } from 'vitest';

import { DocumentNavigationGate } from './document-navigation';

describe('traditional document navigation capture', () => {
  it('suppresses existing startup documents but records later and new loads', () => {
    const gate = new DocumentNavigationGate();
    gate.reset([1, 2]);
    expect(gate.shouldCapture(1)).toBe(false);
    expect(gate.shouldCapture(2)).toBe(false);
    expect(gate.shouldCapture(1)).toBe(true);
    expect(gate.shouldCapture(3)).toBe(true);
  });
});

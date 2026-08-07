import { beforeEach, describe, expect, it } from 'vitest';

import { captureDomEvent } from './dom-capture';

describe('DOM capture privacy', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('discards editable text after classifying it', () => {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    editable.setAttribute('contenteditable', 'true');
    editable.textContent = 'alex.person@example.com';
    document.body.append(editable);

    const event = captureDomEvent(
      new Event('change', { bubbles: true }),
      'https://erp.example.test/editor',
    );
    // A synthetic Event has no target, so dispatch through the element instead.
    let captured = null;
    editable.addEventListener('change', (change) => {
      captured = captureDomEvent(change, 'https://erp.example.test/editor');
    });
    editable.dispatchEvent(new Event('change', { bubbles: true }));
    expect(event).toBeNull();
    expect(captured).toMatchObject({
      actionType: 'input',
      elementLabel: null,
      semanticInputToken: '[EMAIL]',
    });
    expect(JSON.stringify(captured)).not.toContain('alex.person@example.com');
  });

  it('never treats editable or textarea values as click labels', () => {
    for (const editable of [
      Object.assign(document.createElement('textarea'), {
        textContent: '4111 1111 1111 1111',
      }),
      Object.assign(document.createElement('div'), {
        textContent: 'alex.person@example.com',
      }),
    ]) {
      if (editable instanceof HTMLDivElement)
        editable.setAttribute('contenteditable', 'true');
      document.body.append(editable);
      let captured = null;
      editable.addEventListener('click', (click) => {
        captured = captureDomEvent(click, 'https://erp.example.test/editor');
      });
      editable.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(captured).toMatchObject({
        actionType: 'click',
        elementLabel: null,
      });
      expect(JSON.stringify(captured)).not.toMatch(
        /alex\.person@example\.com|4111 1111 1111 1111/,
      );
      editable.remove();
    }
  });

  it('does not retain a download filename or URL', () => {
    const anchor = document.createElement('a');
    anchor.href =
      'https://erp.example.test/files/customer-payroll.xlsx?secret=1';
    anchor.download = 'customer-payroll.xlsx';
    anchor.textContent = 'customer-payroll.xlsx';
    document.body.append(anchor);
    let captured = null;
    anchor.addEventListener('click', (click) => {
      captured = captureDomEvent(click, 'https://erp.example.test/reports');
      click.preventDefault();
    });
    anchor.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );

    expect(captured).toMatchObject({
      actionType: 'file_download',
      elementLabel: null,
      semanticInputToken: '[FILE:SPREADSHEET]',
    });
    expect(JSON.stringify(captured)).not.toContain('customer-payroll');
    expect(JSON.stringify(captured)).not.toContain('secret=1');
  });
});

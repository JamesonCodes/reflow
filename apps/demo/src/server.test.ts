import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { createDemoServer } from './server.js';

const servers = new Set<ReturnType<typeof createDemoServer>>();

afterEach(async () => {
  await Promise.all(
    [...servers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          if (!server.listening) {
            resolve();
            return;
          }
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
  servers.clear();
});

async function startFixture() {
  const server = createDemoServer();
  servers.add(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

describe('multi-system browser fixture', () => {
  it('serves every application route through the reusable shell', async () => {
    const origin = await startFixture();
    for (const route of [
      '/',
      '/inbox',
      '/invoices/INV-1042',
      '/vendors/ACME-42',
      '/payments/new',
      '/private/vendor-login',
    ]) {
      const response = await fetch(`${origin}${route}`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('Reflow Workflow Lab');
    }
  });

  it('serves a realistic download and health endpoint', async () => {
    const origin = await startFixture();
    const download = await fetch(`${origin}/download/reconciliation.csv`);
    expect(download.headers.get('content-disposition')).toContain(
      'reflow-demo-reconciliation.csv',
    );
    expect(await download.text()).toContain('INV-1042,ready,2840.00');

    await expect(
      fetch(`${origin}/health`).then((response) => response.json()),
    ).resolves.toEqual({
      status: 'ok',
    });
  });
});

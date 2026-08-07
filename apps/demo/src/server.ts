import { createReadStream } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url));

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function commonHeaders(contentType: string) {
  return {
    'cache-control': 'no-store',
    'content-security-policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "form-action 'self'",
    ].join('; '),
    'content-type': contentType,
    'x-content-type-options': 'nosniff',
  };
}

async function sendAsset(path: string, response: ServerResponse) {
  const assetPath = fileURLToPath(new URL(`../public${path}`, import.meta.url));
  if (!assetPath.startsWith(publicDirectory)) return false;
  try {
    await access(assetPath);
  } catch {
    return false;
  }
  response.writeHead(
    200,
    commonHeaders(
      contentTypes[extname(assetPath)] ?? 'application/octet-stream',
    ),
  );
  createReadStream(assetPath).pipe(response);
  return true;
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (url.pathname === '/health') {
    response.writeHead(200, commonHeaders('application/json; charset=utf-8'));
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (url.pathname === '/download/reconciliation.csv') {
    response.writeHead(200, {
      ...commonHeaders('text/csv; charset=utf-8'),
      'content-disposition':
        'attachment; filename="reflow-demo-reconciliation.csv"',
    });
    response.end('invoice,status,amount\nINV-1042,ready,2840.00\n');
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    if (await sendAsset(url.pathname, response)) return;
    response.writeHead(404, commonHeaders('text/plain; charset=utf-8'));
    response.end('Asset not found');
    return;
  }

  const html = await readFile(
    new URL('../public/index.html', import.meta.url),
    'utf8',
  );
  response.writeHead(200, commonHeaders('text/html; charset=utf-8'));
  response.end(html);
}

export function createDemoServer(): Server {
  return createServer((request, response) => {
    void handleRequest(request, response).catch(() => {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      response.writeHead(500, commonHeaders('text/plain; charset=utf-8'));
      response.end('Demo fixture failed to render');
    });
  });
}

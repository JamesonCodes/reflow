import { createDemoServer } from './server.js';

const requestedPort = Number.parseInt(
  process.env.REFLOW_DEMO_PORT ?? '3100',
  10,
);
const port = Number.isFinite(requestedPort) ? requestedPort : 3100;

createDemoServer().listen(port, '0.0.0.0', () => {
  console.log(`Reflow demo ready: http://ap.localhost:${port}`);
});

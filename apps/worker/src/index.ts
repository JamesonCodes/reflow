export const workerStatus = {
  productName: 'Reflow',
  status: 'foundation',
} as const;

if (process.env['NODE_ENV'] !== 'test') {
  console.log('Reflow worker foundation ready. Processing begins in Phase 2.');
}

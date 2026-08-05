import type { NextConfig } from 'next';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const { loadEnvConfig } = createRequire(import.meta.url)('@next/env') as {
  loadEnvConfig: (
    directory: string,
    development: boolean,
    logger: Console,
    forceReload: boolean,
  ) => unknown;
};

loadEnvConfig(
  fileURLToPath(new URL('../..', import.meta.url)),
  process.env.NODE_ENV !== 'production',
  console,
  true,
);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;

import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const nextConfig: NextConfig = {
  outputFileTracingRoot: resolve(process.cwd()),
  ...(process.env.NEXT_DEV_DIST_DIR ? { distDir: process.env.NEXT_DEV_DIST_DIR } : {}),
};

export default nextConfig;

import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Trace from the monorepo root so the standalone bundle includes the workspace packages.
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  transpilePackages: ['@ollive/sdk', '@ollive/db', '@ollive/shared'],
  // Linting runs at the monorepo root (turbo run lint); skip Next's build-time lint.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

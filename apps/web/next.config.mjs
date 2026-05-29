/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@ollive/sdk', '@ollive/db', '@ollive/shared'],
  // Linting runs at the monorepo root (turbo run lint); skip Next's build-time lint.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

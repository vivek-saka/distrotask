/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@distrotask/shared'],
  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;

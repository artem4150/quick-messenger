/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { appDir: true },
  async rewrites() {
    // Проксируем все запросы /api/* во внутренний сервис auth-api (порт 5001)
    return [
      { source: '/api/:path*', destination: 'http://auth-api:5001/:path*' }
    ];
  }
};

module.exports = nextConfig;

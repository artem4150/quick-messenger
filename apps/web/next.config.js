/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { appDir: true },
  async rewrites() {
    return [
      // комнаты/контакты/инвайты теперь обслуживает signaling
      { source: '/api/rooms', destination: 'http://signaling:4000/api/rooms' },
      { source: '/api/contacts/:path*', destination: 'http://signaling:4000/api/contacts/:path*' },
      { source: '/api/invites/:path*', destination: 'http://signaling:4000/api/invites/:path*' },

      // всё остальное — как и раньше в auth-api
      { source: '/api/:path*', destination: 'http://auth-api:5001/:path*' },
    ];
  },
};

module.exports = nextConfig;

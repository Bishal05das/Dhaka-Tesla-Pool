import type { NextConfig } from 'next';

// Where the Express API lives, as seen from the Next.js server: http://api:4000 inside
// docker compose, the Render URL in production. Read at build time and baked into the build.
const apiUrl = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // The browser only ever talks to this app. /api/* is forwarded to Express, so the session
  // cookie is first-party (SameSite=Lax works) and no CORS is needed, even when the web app
  // and the API are hosted on different domains.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;

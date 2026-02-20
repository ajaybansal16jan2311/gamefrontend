/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Proxy /api/* to backend so browser makes same-origin requests (no CORS needed)
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

module.exports = nextConfig;


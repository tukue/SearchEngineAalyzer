/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_BASE_URL ?? "http://localhost:5000"}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig

const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    externalDir: true,
  },
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(__dirname),
      "@client": path.resolve(__dirname, "../client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@server": path.resolve(__dirname, "./server")
    };
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_BASE_URL ?? "http://localhost:5000"}/api/:path*`,
      },
    ]
  },
};

module.exports = nextConfig;

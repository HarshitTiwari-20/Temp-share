import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: require("path").join(__dirname),
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  // Allow large file uploads via API routes
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "ioredis",
    "bullmq",
    "@aws-sdk/client-s3",
  ],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "9000" },
      { protocol: "https", hostname: "**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'ssh2', 'node-ssh'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('better-sqlite3', 'ssh2', 'node-ssh');
    }
    return config;
  },
};

export default nextConfig;

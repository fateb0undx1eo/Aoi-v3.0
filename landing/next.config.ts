import type { NextConfig } from "next";
import path from "path";
import { codeInspectorPlugin } from "code-inspector-plugin";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
    ],
  },
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    rules: codeInspectorPlugin({
      bundler: "turbopack",
      hotKeys: ["ctrlKey", "shiftKey"],
      injectTo: [path.resolve("src/pages/_app.tsx")],
    }),
  },
};

export default nextConfig;

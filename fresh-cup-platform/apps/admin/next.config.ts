import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@fresh-cup/ui",
    "@fresh-cup/utils",
    "@fresh-cup/types",
    "@fresh-cup/api-client",
  ],
};

export default nextConfig;

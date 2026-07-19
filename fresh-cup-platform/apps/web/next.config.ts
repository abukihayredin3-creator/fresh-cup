import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@fresh-cup/ui",
    "@fresh-cup/utils",
    "@fresh-cup/types",
    "@fresh-cup/api-client",
    "@fresh-cup/i18n",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.freshcupjuicehouse.com" },
      { protocol: "https", hostname: "**.freshcupjuicehouse.com" },
    ],
  },
};

export default withNextIntl(nextConfig);

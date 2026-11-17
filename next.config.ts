import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const nextConfig: NextConfig = {
  experimental: { agentUpgrade: "security" },
  turbopack: { root: process.cwd() },
};

export default withNextIntl(nextConfig);

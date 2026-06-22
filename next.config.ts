import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // These packages must not be bundled by Next — they rely on Node built-ins / native
  // resolution and run on the Workers Node-compat runtime as external server packages.
  serverExternalPackages: [
    "@prisma/client",
    ".prisma/client",
    "postgres",
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
  ],
};

// Lets `next dev` access Cloudflare bindings (R2, etc.) defined in wrangler.jsonc.
// No-op for `next build`.
initOpenNextCloudflareForDev();

export default nextConfig;

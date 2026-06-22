import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tenantModels from "./config/tenant-models.json" with { type: "json" };

// Tenant-isolation guard: bare `prisma.<tenantModel>` and bare `prisma.$transaction` are forbidden
// outside the data-access layer — all tenant access must go through tenantDb()/tenantTransaction()
// (see lib/tenant-db.ts + CLAUDE.md). Driven by config/tenant-models.json (single source of truth).
const restrictedPrismaProperties = [
  ...tenantModels.map((model) => ({
    object: "prisma",
    property: model,
    message: `Tenant data: use tenantDb(orgId).${model} — bare prisma.${model} bypasses tenant isolation.`,
  })),
  {
    object: "prisma",
    property: "$transaction",
    message:
      "Use tenantTransaction() so tenant models stay scoped — never a raw prisma.$transaction outside lib/tenant-db.ts.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-properties": ["error", ...restrictedPrismaProperties],
    },
  },
  {
    // The sanctioned data-access layer + tests may use the raw client.
    files: ["lib/tenant-db.ts", "lib/db.ts", "tests/**"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // OpenNext / Cloudflare generated bundle and types:
    ".open-next/**",
    "cloudflare-env.d.ts",
  ]),
]);

export default eslintConfig;

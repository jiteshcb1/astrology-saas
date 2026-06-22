// Centralized, undefined-safe access to environment variables.
// Nothing here throws on missing values — the scaffold must run with an empty .env.local.
// Validate/require specific vars at the point of use instead.

export const env = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL ?? "",

  // Auth.js
  AUTH_SECRET: process.env.AUTH_SECRET ?? "",
  AUTH_URL: process.env.AUTH_URL ?? "http://localhost:3001",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",

  // Email (Resend)
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",

  // Storage (Cloudflare R2, S3-compatible)
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID ?? "",
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ?? "",
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ?? "",
  R2_BUCKET: process.env.R2_BUCKET ?? "",

  // Monitoring
  SENTRY_DSN: process.env.SENTRY_DSN ?? "",

  // Crypto
  ENCRYPTION_MASTER_KEY: process.env.ENCRYPTION_MASTER_KEY ?? "",
} as const;

export const isDev = process.env.NODE_ENV !== "production";

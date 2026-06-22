import * as Sentry from "@sentry/nextjs";

// Server/edge instrumentation hook. Only loads a Sentry config when a DSN is configured,
// keeping the app fully inert with empty env.
export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captures errors from nested React Server Components. No-op when Sentry is uninitialized.
export const onRequestError = Sentry.captureRequestError;

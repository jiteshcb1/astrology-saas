import * as Sentry from "@sentry/nextjs";

// Inert unless SENTRY_DSN is set — no init, no overhead, no events when the DSN is empty.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
    debug: false,
  });
}

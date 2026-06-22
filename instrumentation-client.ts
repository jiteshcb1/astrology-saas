import * as Sentry from "@sentry/nextjs";

// Client-side Sentry init (Next.js 15.3+ uses instrumentation-client.ts).
// Uses the public DSN so it can be inlined into the browser bundle; inert when empty.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1.0,
    debug: false,
  });
}

// Required for Sentry to capture navigation/router transitions on the client.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

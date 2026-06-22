import { Resend } from "resend";
import { env, isDev } from "@/lib/env";

// Thin, mockable email client. Single `sendEmail()` interface for the whole app.
// STUB: when RESEND_API_KEY is empty we just log to the console (dev) instead of sending.
// TODO: replace the console fallback with real error handling / queueing for production.

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  /** Plain-text body. */
  text?: string;
  /** HTML body. */
  html?: string;
  /** Defaults to a placeholder until a verified domain is configured. */
  from?: string;
}

const DEFAULT_FROM = "Astro Consultancy <onboarding@example.com>";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendEmail(options: SendEmailOptions): Promise<{ ok: boolean; id?: string }> {
  const { to, subject, text, html, from = DEFAULT_FROM } = options;

  if (!resend) {
    // No API key configured — log-only stub.
    console.log("[email:stub] would send email", { to, subject, hasHtml: !!html, hasText: !!text });
    return { ok: true };
  }

  const result = await resend.emails.send({
    from,
    to,
    subject,
    // Resend requires at least one of html/text/react.
    html: html ?? undefined,
    text: text ?? subject,
  });

  if (result.error) {
    if (isDev) console.error("[email] send failed", result.error);
    return { ok: false };
  }

  return { ok: true, id: result.data?.id };
}

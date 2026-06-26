import { Resend } from "resend";
import { env, isDev } from "@/lib/env";
import { isEmailTypeEnabled, type EmailType } from "@/lib/platform-settings";

// Thin, mockable email client. Single `sendEmail()` interface for the whole app.
// When RESEND_API_KEY is empty (local dev) we log instead of sending, so the app runs keyless.
// Never throws — failures return { ok: false } so callers (post-commit notifications) can't break a flow.

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  /** Plain-text body. */
  text?: string;
  /** HTML body. */
  html?: string;
  /** Defaults to env.EMAIL_FROM (the verified domain). */
  from?: string;
  /** Reply-To — seeker emails set this to the consultant's own email. */
  replyTo?: string;
  /** Which notification type this is — gated by the super-admin per-type + master kill-switch. */
  type: EmailType;
}

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendEmail(options: SendEmailOptions): Promise<{ ok: boolean; id?: string }> {
  const { to, subject, text, html, from = env.EMAIL_FROM, replyTo, type } = options;

  // Kill-switch (super-admin → Settings → Email Notification Management): a send needs BOTH the master switch
  // and this type enabled. Paused → skip silently; return ok so no flow breaks.
  if (!(await isEmailTypeEnabled(type))) {
    console.log("[email] paused:", type, "—", subject);
    return { ok: true };
  }

  if (!resend) {
    // No API key configured — log-only stub.
    console.log("[email:stub] would send email", { to, subject, hasHtml: !!html, hasText: !!text });
    return { ok: true };
  }

  try {
    const result = await resend.emails.send({
      from,
      to,
      subject,
      replyTo, // Resend SDK v6 accepts camelCase replyTo
      // Resend requires at least one of html/text/react.
      html: html ?? undefined,
      text: text ?? subject,
    });
    if (result.error) {
      if (isDev) console.error("[email] send failed", result.error);
      return { ok: false };
    }
    return { ok: true, id: result.data?.id };
  } catch (e) {
    if (isDev) console.error("[email] send threw", e);
    return { ok: false };
  }
}

import { readableTextOn } from "@/lib/branding";

// Pure, client-safe email template builders (no server imports). Each returns { subject, html, text }.
// Table-based, inline-styled HTML for mobile email clients + a plain-text fallback. Consultant emails
// carry the consultant's logo + name + themeColor; platform emails (OTP, consultant-facing) use marigold.

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}
export type Locale = "en" | "hi";
const MARIGOLD = "#e8a33d";
const SAND = "#f6efe2";
const INK = "#2a2748";
const MUTED = "#6b6a7d";

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function normLocale(l?: string): Locale {
  return l === "hi" ? "hi" : "en"; // hinglish + unknown → en
}

// Compose a sender display name: "<Consultant> via Astro <addr>" from the base EMAIL_FROM.
export function consultantFrom(name: string, baseFrom: string): string {
  const m = baseFrom.match(/<([^>]+)>/);
  const addr = m ? m[1] : baseFrom;
  const clean = name.replace(/[<>"]/g, "").trim() || "Astro";
  return `${clean} via Astro <${addr}>`;
}

function button(label: string, url: string, accent: string): string {
  const c = readableTextOn(accent);
  return `<a href="${esc(url)}" style="display:inline-block;background:${accent};color:${c};text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:600;font-size:15px;">${esc(label)}</a>`;
}

// The branded shell. accent defaults to marigold (platform emails); consultant emails pass themeColor.
function layout(opts: { accent?: string | null; logoUrl?: string | null; brandName: string; preheader: string; bodyHtml: string }): string {
  const accent = opts.accent || MARIGOLD;
  const onAccent = readableTextOn(accent);
  const logo = opts.logoUrl
    ? `<img src="${esc(opts.logoUrl)}" alt="${esc(opts.brandName)}" height="44" style="height:44px;border-radius:8px;display:block;margin:0 auto 8px;" />`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${SAND};font-family:Inter,Segoe UI,Arial,sans-serif;color:${INK};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SAND};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(20,18,43,0.08);">
<tr><td align="center" style="background:${accent};color:${onAccent};padding:26px 24px;">${logo}<div style="font-size:20px;font-weight:700;font-family:Georgia,serif;">${esc(opts.brandName)}</div></td></tr>
<tr><td style="padding:26px 24px;font-size:15px;line-height:1.6;">${opts.bodyHtml}</td></tr>
<tr><td style="padding:16px 24px;background:${SAND};color:${MUTED};font-size:12px;line-height:1.5;">Powered by Astro Consultancy</td></tr>
</table></td></tr></table></body></html>`;
}

function recapHtml(rows: [string, string][]): string {
  const trs = rows.map(([k, v]) => `<tr><td style="padding:4px 0;color:${MUTED};">${esc(k)}</td><td style="padding:4px 0;text-align:right;color:${INK};font-weight:600;">${esc(v)}</td></tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:${SAND};border-radius:10px;padding:12px 16px;"><tr><td><table role="presentation" width="100%">${trs}</table></td></tr></table>`;
}

// ── 1. OTP / sign-in (platform-branded) ──────────────────────────────────────
export function otpEmail(code: string): EmailContent {
  const html = layout({
    brandName: "Astro Consultancy",
    preheader: `Your sign-in code is ${code}`,
    bodyHtml: `<p style="margin:0 0 8px;">Your sign-in code is:</p>
<div style="font-size:36px;font-weight:700;letter-spacing:8px;font-family:Menlo,Consolas,monospace;color:${INK};margin:12px 0;">${esc(code)}</div>
<p style="margin:8px 0 0;color:${MUTED};">Valid for 10 minutes. If you didn't request this, you can ignore this email.</p>`,
  });
  return { subject: `Your sign-in code — ${code}`, html, text: `Your Astro Consultancy sign-in code is ${code}. It expires in 10 minutes.` };
}

interface SeekerBrand { consultantName: string; logoUrl?: string | null; accent?: string | null; locale?: string }

// ── 2. Booking confirmed → seeker ────────────────────────────────────────────
export function bookingConfirmedEmail(p: SeekerBrand & { packageTitle: string; whenLabel: string; amountLabel: string; receiptUrl: string; calendarUrl?: string }): EmailContent {
  const hi = normLocale(p.locale) === "hi";
  const accent = p.accent || MARIGOLD;
  const heading = hi ? "आपकी बुकिंग कन्फर्म हो गई!" : "You're booked!";
  const intro = hi ? `${p.consultantName} के साथ आपका सत्र तय हो गया है।` : `Your session with ${p.consultantName} is confirmed.`;
  const html = layout({
    accent, logoUrl: p.logoUrl, brandName: p.consultantName,
    preheader: `${heading} ${p.whenLabel}`,
    bodyHtml: `<h1 style="margin:0 0 6px;font-size:22px;">${esc(heading)}</h1><p style="margin:0;">${esc(intro)}</p>
${recapHtml([[hi ? "सत्र" : "Session", p.packageTitle], [hi ? "कब" : "When", p.whenLabel], [hi ? "राशि" : "Amount paid", p.amountLabel]])}
<div style="margin:18px 0 6px;">${button(hi ? "रसीद देखें" : "View receipt", p.receiptUrl, accent)}</div>
${p.calendarUrl ? `<p style="margin:8px 0 0;"><a href="${esc(p.calendarUrl)}" style="color:${MUTED};font-size:13px;">${hi ? "कैलेंडर में जोड़ें" : "Add to calendar"}</a></p>` : ""}`,
  });
  const text = `${heading}\n${intro}\n\nSession: ${p.packageTitle}\nWhen: ${p.whenLabel}\nAmount paid: ${p.amountLabel}\n\nReceipt: ${p.receiptUrl}`;
  return { subject: hi ? `${p.consultantName} के साथ आपकी बुकिंग कन्फर्म — ${p.whenLabel}` : `Your booking with ${p.consultantName} is confirmed — ${p.whenLabel}`, html, text };
}

// ── 3. Proof received → seeker (pending verification) ─────────────────────────
export function proofReceivedEmail(p: SeekerBrand & { packageTitle: string; whenLabel: string }): EmailContent {
  const hi = normLocale(p.locale) === "hi";
  const accent = p.accent || MARIGOLD;
  const heading = hi ? "हमें आपका भुगतान प्रमाण मिल गया" : "We've got your payment proof";
  const intro = hi ? `${p.consultantName} जल्द ही इसे सत्यापित करके आपकी बुकिंग कन्फर्म करेंगे।` : `${p.consultantName} will verify it shortly and confirm your booking. We'll email you when it's done.`;
  const html = layout({
    accent, logoUrl: p.logoUrl, brandName: p.consultantName,
    preheader: heading,
    bodyHtml: `<h1 style="margin:0 0 6px;font-size:22px;">✓ ${esc(heading)}</h1><p style="margin:0;">${esc(intro)}</p>
${recapHtml([[hi ? "सत्र" : "Session", p.packageTitle], [hi ? "कब" : "When", p.whenLabel]])}`,
  });
  const text = `${heading}\n${intro}\n\nSession: ${p.packageTitle}\nWhen: ${p.whenLabel}`;
  return { subject: hi ? `भुगतान प्रमाण मिला — ${p.consultantName}` : `Payment proof received — ${p.consultantName}`, html, text };
}

// ── 4. Booking declined → seeker ─────────────────────────────────────────────
export function bookingDeclinedEmail(p: SeekerBrand & { packageTitle: string; rebookUrl: string; contact?: string | null }): EmailContent {
  const hi = normLocale(p.locale) === "hi";
  const accent = p.accent || MARIGOLD;
  const heading = hi ? "आपकी बुकिंग के बारे में" : "About your booking";
  const intro = hi
    ? `हम आपके ${p.packageTitle} सत्र के लिए भुगतान सत्यापित नहीं कर सके। कृपया दोबारा बुक करें।`
    : `We couldn't verify the payment for your ${p.packageTitle} session. Please try booking again.`;
  const html = layout({
    accent, logoUrl: p.logoUrl, brandName: p.consultantName,
    preheader: heading,
    bodyHtml: `<h1 style="margin:0 0 6px;font-size:22px;">${esc(heading)}</h1><p style="margin:0 0 4px;">${esc(intro)}</p>
<div style="margin:18px 0 6px;">${button(hi ? "दोबारा बुक करें" : "Book again", p.rebookUrl, accent)}</div>
${p.contact ? `<p style="margin:10px 0 0;color:${MUTED};font-size:13px;">${hi ? "सवाल?" : "Questions?"} ${esc(p.contact)}</p>` : ""}`,
  });
  const text = `${heading}\n${intro}\n\nBook again: ${p.rebookUrl}${p.contact ? `\nContact: ${p.contact}` : ""}`;
  return { subject: hi ? `${p.consultantName}: आपकी बुकिंग के बारे में` : `About your booking with ${p.consultantName}`, html, text };
}

// ── 5. New booking → consultant (platform-branded, internal) ─────────────────
export function newBookingConsultantEmail(p: { seekerName: string; packageTitle: string; whenLabel: string; amountLabel: string; mode: "upi_qr" | "gateway"; bookingsUrl: string }): EmailContent {
  const needsVerify = p.mode === "upi_qr";
  const heading = needsVerify ? "New booking — payment to verify" : "New booking confirmed";
  const html = layout({
    brandName: "Astro Consultancy",
    preheader: `${heading}: ${p.seekerName}`,
    bodyHtml: `<h1 style="margin:0 0 6px;font-size:21px;">${esc(heading)}</h1>
<p style="margin:0;">${needsVerify ? `${esc(p.seekerName)} uploaded a UPI payment proof. Review and confirm it in your dashboard.` : `${esc(p.seekerName)} paid and the booking is confirmed.`}</p>
${recapHtml([["Seeker", p.seekerName], ["Session", p.packageTitle], ["When", p.whenLabel], ["Amount", p.amountLabel]])}
<div style="margin:18px 0 0;">${button(needsVerify ? "Verify payment" : "Open bookings", p.bookingsUrl, MARIGOLD)}</div>`,
  });
  const text = `${heading}\nSeeker: ${p.seekerName}\nSession: ${p.packageTitle}\nWhen: ${p.whenLabel}\nAmount: ${p.amountLabel}\n\n${p.bookingsUrl}`;
  return { subject: `${heading} — ${p.seekerName}`, html, text };
}

// ── 6. Consultant welcome (platform-branded) ─────────────────────────────────
export function consultantWelcomeEmail(p: { orgName: string; signInUrl: string }): EmailContent {
  const html = layout({
    brandName: "Astro Consultancy",
    preheader: `Your consultancy "${p.orgName}" is ready`,
    bodyHtml: `<h1 style="margin:0 0 6px;font-size:21px;">Welcome to Astro Consultancy</h1>
<p style="margin:0;">Your consultancy <strong>${esc(p.orgName)}</strong> is ready. Sign in to set up your profile, packages, availability and payments.</p>
<div style="margin:18px 0 0;">${button("Sign in", p.signInUrl, MARIGOLD)}</div>`,
  });
  const text = `Welcome to Astro Consultancy.\nYour consultancy "${p.orgName}" is ready. Sign in: ${p.signInUrl}`;
  return { subject: `Your consultancy "${p.orgName}" is ready on Astro`, html, text };
}

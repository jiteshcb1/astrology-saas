import type { Lead } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

// SP-6.3 — public lead capture + Super-Admin pipeline. Leads are platform-level (not tenant data), so bare
// prisma.lead is correct here. Cores are free of "use server"/redirect → unit-testable.

export const LEAD_STATUSES = ["new", "contacted", "demo_booked", "converted", "not_interested"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const PRACTICE_TYPES = ["Vedic", "Tarot", "Numerology", "Palmistry", "Vastu", "Other"] as const;
export const HEARD_FROM = ["Instagram", "WhatsApp", "Astrotalk", "JustDial", "Friend", "Other"] as const;

const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour (mirrors lib/otp.ts)
export const MAX_LEADS_PER_IP_PER_HOUR = 3;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

// Indian WhatsApp number → "+91XXXXXXXXXX". Accepts 10 digits, or 91 + 10 digits (with/without +/spaces).
// The 10-digit subscriber number must start 6–9 (Indian mobile).
export function normalizeWhatsApp(raw: string): { ok: true; value: string } | { ok: false } {
  const digits = (raw ?? "").replace(/\D/g, "");
  let ten: string | null = null;
  if (digits.length === 10) ten = digits;
  else if (digits.length === 12 && digits.startsWith("91")) ten = digits.slice(2);
  if (!ten || !/^[6-9]\d{9}$/.test(ten)) return { ok: false };
  return { ok: true, value: `+91${ten}` };
}

// wa.me deep link (digits only, country code, no +): "https://wa.me/91XXXXXXXXXX".
export function waLink(whatsapp: string): string {
  const digits = (whatsapp ?? "").replace(/\D/g, "");
  const withCc = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCc}`;
}

function pick<T extends readonly string[]>(allowed: T, v?: string | null): T[number] | null {
  const t = (v ?? "").trim();
  return (allowed as readonly string[]).includes(t) ? (t as T[number]) : null;
}

export interface LeadInput {
  name: string;
  email: string;
  whatsapp: string;
  practiceType?: string | null;
  heardFrom?: string | null;
  message?: string | null;
}
export type SubmitLeadResult = { ok: true; isRepeat: boolean; lead: Lead } | { ok: false; error: string };

// Validate → rate-limit (per IP/hour) → dedupe by email → save. The DB write ALWAYS happens before any email.
export async function submitLeadCore(input: LeadInput, ip: string | null, now: Date = new Date()): Promise<SubmitLeadResult> {
  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  if (!name) return { ok: false, error: "Please enter your name." };
  if (!isValidEmail(email)) return { ok: false, error: "Please enter a valid email address." };
  const wa = normalizeWhatsApp(input.whatsapp);
  if (!wa.ok) return { ok: false, error: "Please enter a valid Indian WhatsApp number (10 digits)." };

  const practiceType = pick(PRACTICE_TYPES, input.practiceType);
  const heardFrom = pick(HEARD_FROM, input.heardFrom);
  const message = (input.message ?? "").trim() || null;

  if (ip) {
    const recent = await prisma.lead.count({ where: { requestIp: ip, createdAt: { gt: new Date(now.getTime() - RATE_WINDOW_MS) } } });
    if (recent >= MAX_LEADS_PER_IP_PER_HOUR) return { ok: false, error: "rate_limited" };
  }

  const existing = await prisma.lead.findFirst({ where: { email } });
  if (existing) {
    // Repeat inquiry — refresh the latest details + updatedAt, keep the pipeline status.
    const lead = await prisma.lead.update({
      where: { id: existing.id },
      data: { name, whatsapp: wa.value, practiceType, heardFrom, message },
    });
    return { ok: true, isRepeat: true, lead };
  }
  const lead = await prisma.lead.create({
    data: { name, email, whatsapp: wa.value, practiceType, heardFrom, message, status: "new", requestIp: ip },
  });
  return { ok: true, isRepeat: false, lead };
}

export type MutationResult = { ok: true } | { ok: false; error: string };

export async function updateLeadStatusCore(leadId: string, status: string, actorUserId: string): Promise<MutationResult> {
  if (!(LEAD_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Invalid status." };
  await prisma.lead.update({ where: { id: leadId }, data: { status } });
  await writeAuditLog({ actorUserId, action: "lead.update_status", resourceType: "lead", resourceId: leadId, metadata: { status } });
  return { ok: true };
}

export function listLeads(filter?: string) {
  const where = filter && (LEAD_STATUSES as readonly string[]).includes(filter) ? { status: filter } : {};
  return prisma.lead.findMany({ where, orderBy: { createdAt: "desc" } });
}

export function getLead(id: string) {
  return prisma.lead.findUnique({ where: { id } });
}

// Dashboard signal — new leads in the last 7 days.
export function countNewLeadsThisWeek(now: Date = new Date()) {
  return prisma.lead.count({ where: { status: "new", createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } } });
}

"use server";

import { headers } from "next/headers";
import { submitLeadCore } from "@/lib/leads";
import { notifyNewLead, notifyLeadAck } from "@/lib/notifications";

// SP-6.3 — public lead-capture submit. No auth (marketing form). The lead is ALWAYS saved before any email;
// notifications are best-effort (sendEmail never throws and is currently suppressed by the global pause).
export type LeadFormState = { ok?: boolean; error?: string };

export async function submitLeadAction(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const hdrs = await headers();
  const ip = hdrs.get("cf-connecting-ip") ?? hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const res = await submitLeadCore(
    {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      whatsapp: String(formData.get("whatsapp") ?? ""),
      practiceType: String(formData.get("practiceType") ?? "") || null,
      heardFrom: String(formData.get("heardFrom") ?? "") || null,
      message: String(formData.get("message") ?? "") || null,
    },
    ip,
  );

  if (!res.ok) {
    return { error: res.error === "rate_limited" ? "Too many submissions — please try again in a little while." : res.error };
  }

  await notifyNewLead(res.lead);
  await notifyLeadAck(res.lead);
  return { ok: true };
}

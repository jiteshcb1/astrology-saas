import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { getProfile } from "@/lib/consultant-profile";
import { getCalendarIntegration, toSafeView, getValidToken } from "@/lib/calendar";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { CalendarSettings } from "@/components/dashboard/CalendarSettings";
import { disconnectCalendarAction } from "./actions";

const NOTICES: Record<string, { kind: "success" | "error"; text: string }> = {
  connected: { kind: "success", text: "Google Calendar connected." },
  state: { kind: "error", text: "Security check failed — please try connecting again." },
  denied: { kind: "error", text: "Connection cancelled." },
  exchange: { kind: "error", text: "Couldn't complete the connection with Google. Please try again." },
  save: { kind: "error", text: "Couldn't save the connection. Please try again." },
  not_configured: { kind: "error", text: "Calendar connection isn't available yet." },
};

export default async function CalendarSettingsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  // Owner (consultant) or consulting partner — each manages their OWN connection.
  const { role, orgId, memberId } = await requireSection("calendar");
  if (role === "consultant") {
    const profile = await getProfile(orgId);
    if (!profile?.onboardedAt) redirect("/onboarding");
  }

  const view = toSafeView(await getCalendarIntegration(orgId, memberId));
  // Actively validate the stored token so a silently-expired/revoked connection surfaces as "needs reconnect"
  // (getValidToken refreshes if needed and flips status→error on failure). Skipped when not connected.
  const tokenOk = view?.connected ? (await getValidToken(orgId, memberId)).ok : true;
  const { connected, error } = await searchParams;
  const notice = connected ? NOTICES.connected : error ? (NOTICES[error] ?? NOTICES.save) : null;
  const backHref = role === "consultant" ? "/dashboard/settings" : "/dashboard";
  const backLabel = role === "consultant" ? "← Settings" : "← Dashboard";

  return (
    <>
      <PageHeader title="Google Calendar" subtitle="Auto-block busy times and add Meet links to your sessions" />
      <div className="mx-auto w-full max-w-2xl px-6 py-6">
        <Link href={backHref} className="text-sm text-muted hover:text-terra">{backLabel}</Link>
        <div className="mt-4">
          <CalendarSettings view={view} tokenOk={tokenOk} connectHref="/api/calendar/start?return=settings" disconnectAction={disconnectCalendarAction} notice={notice} />
        </div>
      </div>
    </>
  );
}

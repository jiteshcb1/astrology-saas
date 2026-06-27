import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { getEmailSettingsView, MASTER_KEY, type EmailGroup } from "@/lib/platform-settings";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { EmailToggleCard } from "@/components/superadmin/EmailToggleCard";

const GROUPS: EmailGroup[] = ["Authentication", "Seeker", "Consultant", "Team"];

export default async function EmailNotificationsPage() {
  await requireRole("access:superadmin");
  const view = await getEmailSettingsView();

  return (
    <>
      <PageHeader title="Email Notification Management" subtitle="Pause outbound email globally or per notification type" />
      <div className="mx-auto w-full max-w-2xl px-6 py-6">
        <Link href="/superadmin/settings" className="text-sm text-muted hover:text-terra">← Settings</Link>

        {view.globallyPaused ? (
          <p className="mt-4 rounded-control border border-terra/40 bg-terra/10 px-4 py-3 text-sm text-ink">
            <strong>All outbound email is globally paused.</strong> This is locked in code — the toggles below are read-only and can&apos;t enable sending. Email stays off until it&apos;s turned back on in code.
          </p>
        ) : (
          !view.master.enabled && (
            <p className="mt-4 rounded-control border border-terra/40 bg-terra/10 px-4 py-3 text-sm text-ink">
              <strong>All outbound email is paused.</strong> The master switch is off, so nothing is sent regardless of the per-type switches below.
            </p>
          )
        )}

        <div className="mt-4 space-y-6">
          <EmailToggleCard
            settingKey={MASTER_KEY}
            title="Pause all outbound email"
            description="Master switch. When off, NO email is sent — regardless of the per-type switches below."
            warning="All outbound email is paused."
            initialEnabled={view.master.enabled}
            updatedAtISO={view.master.updatedAtISO}
            locked={view.globallyPaused}
          />

          {GROUPS.map((group) => {
            const items = view.types.filter((t) => t.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{group}</h2>
                <div className="space-y-3">
                  {items.map((t) => (
                    <EmailToggleCard
                      key={t.key}
                      settingKey={t.key}
                      title={t.label}
                      description={t.description}
                      warning={t.key === "otp" ? "Email-only sign-in is blocked while this is off (Google sign-in still works)." : undefined}
                      initialEnabled={t.enabled}
                      updatedAtISO={t.updatedAtISO}
                      locked={view.globallyPaused}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getProfile } from "@/lib/consultant-profile";
import { getBranding } from "@/lib/branding";
import { getPaymentMethod } from "@/lib/payments";
import { listPackages } from "@/lib/packages";
import { getLegalDocuments, legalHasContent } from "@/lib/legal";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { MetricCard } from "@/components/superadmin/MetricCard";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { SetupChecklist, type ChecklistItem } from "@/components/dashboard/SetupChecklist";
import { StatCardSparkline } from "@/components/dashboard/StatCardSparkline";
import { ConsultationCalendar } from "@/components/dashboard/ConsultationCalendar";
import { DonutChart, LineAreaChart, toneHex } from "@/components/dashboard/Charts";
import {
  DEMO_EXPENSE_SERIES,
  DEMO_LAST_CONSULTATIONS,
  DEMO_METRICS,
  DEMO_PAYMENTS,
  DEMO_RECENT_ACTIVITY,
  DEMO_REVENUE_BY_SERVICE,
  DEMO_REVENUE_SERIES,
  DEMO_REVENUE_TOTAL_PAISE,
  DEMO_SERIES_LABELS,
  isDashboardDemo,
} from "@/lib/demo-data";

const lastStatusTone = { completed: "success", no_show: "danger", refunded: "neutral" } as const;
const payStatusTone = { success: "success", pending_verification: "warning", refunded: "neutral" } as const;

export default async function DashboardHome() {
  const { session, role } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  const profile = orgId ? await getProfile(orgId) : null;
  if (role === "consultant" && (!orgId || !profile?.onboardedAt)) redirect("/onboarding");
  const branding = orgId ? await getBranding(orgId) : null;
  const paymentMethod = orgId ? await getPaymentMethod(orgId) : null;
  const packageCount = orgId ? (await listPackages(orgId)).length : 0;
  const legal = orgId ? await getLegalDocuments(orgId) : null;
  const legalDone = legalHasContent(legal?.privacyPolicy) && legalHasContent(legal?.termsConditions);

  const profileComplete = Boolean(profile?.bio && profile.bio.trim());
  const checklist: ChecklistItem[] = [
    { label: "Complete onboarding", done: Boolean(profile?.onboardedAt) },
    { label: "Complete your public profile", done: profileComplete, href: "/dashboard/settings/profile", cta: "Edit" },
    { label: "Connect Google Calendar", done: false, soon: true },
    { label: "Brand your booking page", done: Boolean(branding?.themeColor), href: "/dashboard/settings/branding", cta: "Set up" },
    { label: "Set up payments", done: Boolean(paymentMethod), href: "/dashboard/settings/payments", cta: "Set up" },
    { label: "Add your legal pages", done: legalDone, href: "/dashboard/settings/legal", cta: "Set up" },
    { label: "Create your first package", done: packageCount > 0, href: "/dashboard/packages/new", cta: "Create" },
  ];

  if (!isDashboardDemo()) {
    // Honest empty-state dashboard (production until SP-3/SP-4 supply real data).
    return (
      <>
        <PageHeader title="Home" subtitle="Your central hub for scheduling and consultations" />
        <div className="mx-auto w-full max-w-6xl px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Bookings this month" value="0" hint="Arrives with bookings" />
            <MetricCard label="Earnings (₹)" value="₹0" hint="Arrives with payments" />
            <MetricCard label="Upcoming calls" value="0" hint="None scheduled yet" />
            <MetricCard label="Avg. rating" value="—" hint="After your first reviews" />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Card>
              <h2 className="mb-1 font-display text-lg text-ink">Upcoming consultations</h2>
              <EmptyState title="No upcoming consultations yet" message="Once your booking page is live, calls show up here." />
            </Card>
            <Card>
              <h2 className="mb-1 font-display text-lg text-ink">Finish your setup</h2>
              <SetupChecklist items={checklist} />
            </Card>
          </div>
        </div>
      </>
    );
  }

  const rupeesRounded = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

  return (
    <>
      <PageHeader title="Home" subtitle="Your central hub for scheduling and consultations" />
      <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-6">
        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DEMO_METRICS.map((m) => (
            <StatCardSparkline key={m.key} metric={m} />
          ))}
        </div>

        {/* Calendar + day rail */}
        <ConsultationCalendar />

        {/* Performance + Revenue by service + Recent activity */}
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr_1fr]">
          <Card>
            <div className="mb-3 flex items-center gap-4">
              <h2 className="font-display text-lg text-ink">Performance overview</h2>
              <span className="flex items-center gap-1 text-xs text-muted">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: toneHex("marigold") }} /> Revenue
              </span>
              <span className="flex items-center gap-1 text-xs text-muted">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: toneHex("terra") }} /> Expenses
              </span>
            </div>
            <LineAreaChart
              series={[
                { data: DEMO_REVENUE_SERIES, tone: "marigold" },
                { data: DEMO_EXPENSE_SERIES, tone: "terra" },
              ]}
              labels={DEMO_SERIES_LABELS}
            />
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-lg text-ink">Revenue by service</h2>
            <DonutChart
              slices={DEMO_REVENUE_BY_SERVICE.map((s) => ({ pct: s.pct, tone: s.tone }))}
              center={
                <>
                  <div className="font-display text-xl text-ink">{rupeesRounded(DEMO_REVENUE_TOTAL_PAISE)}</div>
                  <div className="text-xs text-muted">Total</div>
                </>
              }
            />
            <ul className="mt-4 space-y-1.5 text-sm">
              {DEMO_REVENUE_BY_SERVICE.map((s) => (
                <li key={s.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: toneHex(s.tone) }} />
                  <span className="flex-1 text-muted">{s.name}</span>
                  <span className="text-ink">{rupeesRounded(s.amount)}</span>
                  <span className="w-8 text-right text-muted">{s.pct}%</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-lg text-ink">Recent activity</h2>
            <ul className="space-y-3">
              {DEMO_RECENT_ACTIVITY.map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: toneHex(a.tone) }} />
                  <div className="min-w-0">
                    <div className="text-ink">{a.text}</div>
                    <div className="text-xs text-muted">{a.time}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Last consultations + Payments */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-0">
            <h2 className="px-5 pt-5 font-display text-lg text-ink">Last consultations</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-y border-line bg-sand-2/40 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Seeker</th>
                  <th className="px-3 py-2.5 font-medium">Package</th>
                  <th className="px-3 py-2.5 font-medium">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_LAST_CONSULTATIONS.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">{c.seekerName}</div>
                      <div className="text-xs text-muted">{c.seekerEmail} · {c.date}</div>
                    </td>
                    <td className="px-3 py-3 text-muted">{c.packageName}</td>
                    <td className="px-3 py-3 text-ink">{c.amount}</td>
                    <td className="px-3 py-3">
                      <StatusChip label={c.status.replace("_", " ")} tone={lastStatusTone[c.status]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="p-0">
            <h2 className="px-5 pt-5 font-display text-lg text-ink">Recent payments</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-y border-line bg-sand-2/40 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Seeker</th>
                  <th className="px-3 py-2.5 font-medium">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Method</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_PAYMENTS.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">{p.seekerName}</div>
                      <div className="text-xs text-muted">{p.date}</div>
                    </td>
                    <td className="px-3 py-3 text-ink">{p.amount}</td>
                    <td className="px-3 py-3 text-muted">{p.method}</td>
                    <td className="px-3 py-3">
                      <StatusChip label={p.status.replace("_", " ")} tone={payStatusTone[p.status]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Setup checklist */}
        <Card>
          <h2 className="mb-1 font-display text-lg text-ink">Finish your setup</h2>
          <SetupChecklist items={checklist} />
        </Card>

        <p className="text-center text-xs text-muted">
          Showing sample data for design preview — live bookings &amp; payments arrive in SP-3/SP-4.
        </p>
      </div>
    </>
  );
}

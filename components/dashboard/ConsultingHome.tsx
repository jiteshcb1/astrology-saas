import { getMemberDashboard, type MemberBooking } from "@/lib/member-bookings";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { MetricCard } from "@/components/superadmin/MetricCard";
import { PageHeader } from "@/components/superadmin/PageHeader";

const TZ = "Asia/Kolkata";
function fmt(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ }).format(d);
}
function statusTone(s: string): "success" | "warning" | "danger" | "neutral" {
  if (s === "confirmed") return "success";
  if (s === "pending_verification") return "warning";
  if (s === "cancelled") return "danger";
  return "neutral";
}
function initial(name: string | null): string {
  return ((name?.trim() || "?")[0] ?? "?").toUpperCase();
}

export async function ConsultingHome({ orgId, memberId }: { orgId: string; memberId: string }) {
  const now = new Date();
  const { stats, upcoming, past } = await getMemberDashboard(orgId, memberId, now, TZ);

  const joinable = (b: MemberBooking) =>
    Boolean(b.meetLink && b.startsAt && now.getTime() >= b.startsAt.getTime() - 15 * 60_000 && (!b.endsAt || now.getTime() <= b.endsAt.getTime()));

  return (
    <>
      <PageHeader title="My Bookings" subtitle="Your assigned consultations" />
      <div className="mx-auto w-full max-w-5xl px-6 py-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Today's sessions" value={String(stats.today)} />
          <MetricCard label="This week" value={String(stats.thisWeek)} />
          <MetricCard label="Completed" value={String(stats.totalCompleted)} />
          <MetricCard label="Upcoming this month" value={String(stats.upcomingThisMonth)} />
        </div>

        <h2 className="mb-3 mt-8 font-display text-lg text-ink">Upcoming sessions</h2>
        {upcoming.length === 0 ? (
          <Card>
            <EmptyState title="No upcoming sessions" message="Bookings assigned to you will appear here." />
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => (
              <Card key={b.id} className="flex items-start gap-3 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-marigold/20 font-display text-sm text-ink">{initial(b.seekerName)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{b.seekerName || "Seeker"}</span>
                    <span className="text-sm text-muted">· {b.packageTitle}</span>
                    <StatusChip label={b.status.replace(/_/g, " ")} tone={statusTone(b.status)} />
                  </div>
                  <div className="mt-0.5 text-sm text-muted">{fmt(b.startsAt)} · {b.durationMin} min</div>
                  <div className="mt-0.5 text-xs text-muted">{b.seekerEmail || "—"}{b.seekerPhone ? ` · ${b.seekerPhone}` : ""}</div>
                </div>
                {joinable(b) ? (
                  <a href={b.meetLink!} target="_blank" rel="noreferrer" className="shrink-0 rounded-control bg-marigold px-4 py-2 text-sm font-semibold text-night transition hover:-translate-y-0.5">Join call</a>
                ) : (
                  <span className="shrink-0 text-xs text-muted">Join opens 15 min before</span>
                )}
              </Card>
            ))}
          </div>
        )}

        <h2 className="mb-3 mt-8 font-display text-lg text-ink">Past sessions</h2>
        {past.length === 0 ? (
          <Card>
            <EmptyState title="No past sessions yet" message="Your session history will build here." />
          </Card>
        ) : (
          <div className="max-h-96 overflow-y-auto rounded-card border border-line bg-white">
            {past.map((b, i) => (
              <div key={b.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{b.seekerName || "Seeker"} <span className="text-muted">· {b.packageTitle}</span></span>
                <span className="text-xs text-muted">{fmt(b.startsAt)}</span>
                <StatusChip label={b.status === "confirmed" ? "completed" : b.status.replace(/_/g, " ")} tone={statusTone(b.status)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

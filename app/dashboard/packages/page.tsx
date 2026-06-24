import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getProfile } from "@/lib/consultant-profile";
import { listPackages } from "@/lib/packages";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { deletePackageAction, setPackageActiveAction } from "./actions";

export default async function PackagesPage() {
  const { session, role } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  const profile = orgId ? await getProfile(orgId) : null;
  if (role === "consultant" && (!orgId || !profile?.onboardedAt)) redirect("/onboarding");

  const packages = orgId ? await listPackages(orgId) : [];

  return (
    <>
      <PageHeader title="Packages" subtitle="Your consultation offerings and prices">
        <Link href="/dashboard/packages/new" className="rounded-control bg-marigold px-4 py-2.5 text-sm font-semibold text-night transition hover:-translate-y-0.5">
          Create package
        </Link>
      </PageHeader>
      <div className="mx-auto w-full max-w-4xl px-6 py-6">
        {packages.length === 0 ? (
          <Card>
            <div className="py-8 text-center">
              <h2 className="font-display text-lg text-ink">No packages yet</h2>
              <p className="mt-1 text-sm text-muted">Create your first consultation type so seekers can book.</p>
              <Link href="/dashboard/packages/new" className="mt-4 inline-block rounded-control bg-marigold px-4 py-2.5 text-sm font-semibold text-night">
                Create a package
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {packages.map((p) => (
              <Card key={p.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-lg text-ink">{p.title}</h2>
                  <StatusChip label={p.isActive ? "Active" : "Inactive"} tone={p.isActive ? "success" : "neutral"} />
                </div>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.allowedDurations.map((d) => (
                    <span key={d} className="rounded-full bg-sand-2/60 px-2 py-0.5 text-xs text-ink">{d} min</span>
                  ))}
                  <span className="rounded-full bg-sand-2/60 px-2 py-0.5 text-xs text-ink">Google Meet</span>
                </div>
                <div className="mt-3 font-display text-xl text-ink">{formatMoney(p.price)}</div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <Link href={`/dashboard/packages/${p.id}`} className="rounded-control border border-line px-3 py-2 text-sm text-ink transition hover:border-marigold">
                    Edit
                  </Link>
                  <form action={setPackageActiveAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="isActive" value={(!p.isActive).toString()} />
                    <button type="submit" className="rounded-control border border-line px-3 py-2 text-sm text-ink transition hover:border-marigold">
                      {p.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                  <div className="ml-auto">
                    <ConfirmDeleteButton action={deletePackageAction}>
                      <input type="hidden" name="id" value={p.id} />
                    </ConfirmDeleteButton>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

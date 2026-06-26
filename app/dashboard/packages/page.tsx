import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { getProfile } from "@/lib/consultant-profile";
import { listPackages } from "@/lib/packages";
import { getBranding } from "@/lib/branding";
import { getSignedUrl } from "@/lib/storage";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { LandingPreviewWorkspace } from "@/components/dashboard/LandingPreviewWorkspace";
import { deletePackageAction, setPackageActiveAction } from "./actions";

// Plain-text excerpt from the (rich-text HTML) description for the card list: strip tags + decode the
// common HTML entities Quill emits (e.g. &nbsp;) so the preview reads as clean text.
function excerpt(html: string | null): string {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export default async function PackagesPage() {
  const { role, orgId } = await requireSection("packages");
  const profile = orgId ? await getProfile(orgId) : null;
  if (role === "consultant" && (!orgId || !profile?.onboardedAt)) redirect("/onboarding");

  const packages = orgId ? await listPackages(orgId) : [];
  const branding = orgId ? await getBranding(orgId) : null;
  const logoUrl = branding?.logoKey ? await getSignedUrl(branding.logoKey) : null;
  const social = (profile?.socialLinks ?? {}) as Record<string, string>;

  const wsProfile = {
    displayName: profile?.displayName ?? "",
    bio: profile?.bio ?? "",
    experience: profile?.experience ?? "",
    specialities: profile?.specialities ?? [],
    complaintsContactNumber: profile?.complaintsContactNumber ?? "",
    website: social.website ?? "",
    instagram: social.instagram ?? "",
    youtube: social.youtube ?? "",
    x: social.x ?? "",
    gstNumber: profile?.gstNumber ?? "",
    gstLegalName: profile?.gstLegalName ?? "",
  };
  const wsPackages = packages.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    description: p.description ?? "",
    priceRupees: String(Math.round(p.price / 100)),
    allowedDurations: p.allowedDurations,
    defaultDurationMin: p.defaultDurationMin,
    allowBookerChooseDuration: p.allowBookerChooseDuration,
    bufferBeforeMin: p.bufferBeforeMin,
    bufferAfterMin: p.bufferAfterMin,
    minNoticeMin: p.minNoticeMin,
    slotIntervalMin: p.slotIntervalMin,
    freqLimit: (p.freqLimit ?? {}) as { per_day?: number; per_week?: number; per_month?: number },
    isActive: p.isActive,
  }));

  return (
    <>
      <PageHeader title="Packages" subtitle="Your consultation offerings and prices">
        <LandingPreviewWorkspace
          profile={wsProfile}
          branding={{ themeColor: branding?.themeColor ?? null, logoUrl }}
          packages={wsPackages}
        />
        <Link href="/dashboard/packages/new" className="rounded-control bg-marigold px-4 py-2.5 text-sm font-semibold text-night transition hover:-translate-y-0.5">
          Create package
        </Link>
      </PageHeader>
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        {packages.length === 0 ? (
          <Card>
            <EmptyState
              variant="no_packages_consultant"
              cta={<Link href="/dashboard/packages/new" className="inline-block rounded-control bg-marigold px-4 py-2.5 text-sm font-semibold text-night">Create your first package →</Link>}
            />
          </Card>
        ) : (
          <div className="grid items-stretch gap-5 md:grid-cols-2">
            {packages.map((p) => {
              const desc = excerpt(p.description);
              return (
                <Card key={p.id} className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-lg text-ink">{p.title}</h2>
                    <StatusChip label={p.isActive ? "Active" : "Inactive"} tone={p.isActive ? "success" : "neutral"} />
                  </div>
                  {desc && <p className="mt-1 line-clamp-3 text-sm text-muted">{desc}</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.allowedDurations.map((d) => (
                      <span key={d} className="rounded-full bg-sand-2/60 px-2 py-0.5 text-xs text-ink">{d} min</span>
                    ))}
                    <span className="rounded-full bg-sand-2/60 px-2 py-0.5 text-xs text-ink">Google Meet</span>
                  </div>
                  <div className="mt-3 font-display text-xl text-ink">{formatMoney(p.price)}</div>
                  {/* Actions pinned to the bottom, aligned across the row. */}
                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
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
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

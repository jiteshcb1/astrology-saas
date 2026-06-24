"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { PublicBookingPage } from "@/components/public/PublicBookingPage";
import { SPECIALITY_OPTIONS } from "@/lib/consultant-profile";
import { formatMoney } from "@/lib/money";
import { updateProfileAction } from "@/app/dashboard/settings/actions";
import { quickSavePackageAction, setPackageActiveAction } from "@/app/dashboard/packages/actions";

export interface WsProfile {
  displayName: string;
  bio: string;
  experience: string;
  specialities: string[];
  complaintsContactNumber: string;
  website: string;
  instagram: string;
  youtube: string;
  x: string;
  gstNumber: string;
  gstLegalName: string;
}
export interface WsPackage {
  id: string;
  title: string;
  slug: string;
  description: string;
  priceRupees: string;
  allowedDurations: number[];
  defaultDurationMin: number;
  allowBookerChooseDuration: boolean;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  slotIntervalMin: number;
  freqLimit: { per_day?: number; per_week?: number; per_month?: number };
  isActive: boolean;
}

type Layer = "closed" | "preview" | "edit";

const textareaClass =
  "w-full rounded-control border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-marigold";

export function LandingPreviewWorkspace({
  profile,
  branding,
  packages,
}: {
  profile: WsProfile;
  branding: { themeColor: string | null; logoUrl: string | null };
  packages: WsPackage[];
}) {
  const [layer, setLayer] = useState<Layer>("closed");
  const [tab, setTab] = useState<"profile" | "packages">("profile");
  const [prof, setProf] = useState({ displayName: profile.displayName, bio: profile.bio, specialities: profile.specialities });
  const [pkgs, setPkgs] = useState<WsPackage[]>(packages);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Esc closes the topmost layer.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setLayer((l) => (l === "edit" ? "preview" : "closed"));
    }
    if (layer !== "closed") document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [layer]);

  const durationLabel = (p: WsPackage) =>
    p.allowBookerChooseDuration ? `${[...p.allowedDurations].sort((a, b) => a - b).join("/")} min` : `${p.defaultDurationMin} min`;
  const priceLabel = (p: WsPackage) => formatMoney(Math.round((parseFloat(p.priceRupees) || 0) * 100));

  const previewPackages = pkgs
    .filter((p) => p.isActive)
    .map((p) => ({
      id: p.id,
      title: p.title,
      durationLabel: durationLabel(p),
      priceLabel: priceLabel(p),
      descriptionHtml: p.description,
      defaultDurationMin: p.defaultDurationMin,
      allowedDurations: p.allowedDurations,
      allowBookerChooseDuration: p.allowBookerChooseDuration,
    }));

  const setPkg = (id: string, patch: Partial<WsPackage>) =>
    setPkgs((cur) => cur.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  async function saveProfile() {
    setSavingProfile(true);
    setProfileMsg(null);
    const fd = new FormData();
    fd.set("displayName", prof.displayName);
    fd.set("bio", prof.bio);
    fd.set("experience", profile.experience);
    fd.set("specialities", prof.specialities.join(", "));
    fd.set("website", profile.website);
    fd.set("instagram", profile.instagram);
    fd.set("youtube", profile.youtube);
    fd.set("x", profile.x);
    fd.set("gstNumber", profile.gstNumber);
    fd.set("gstLegalName", profile.gstLegalName);
    fd.set("complaintsContactNumber", profile.complaintsContactNumber);
    const res = await updateProfileAction({}, fd);
    setSavingProfile(false);
    setProfileMsg(res.ok ? "Saved." : res.error ?? "Could not save.");
  }

  async function savePackage(p: WsPackage) {
    setSavingId(p.id);
    const fd = new FormData();
    fd.set("id", p.id);
    fd.set("title", p.title);
    fd.set("slug", p.slug);
    fd.set("description", p.description);
    const effective = p.allowBookerChooseDuration ? p.allowedDurations : [p.defaultDurationMin];
    effective.forEach((d) => fd.append("durations", String(d)));
    fd.set("defaultDurationMin", String(p.defaultDurationMin));
    if (p.allowBookerChooseDuration) fd.set("allowBookerChooseDuration", "on");
    fd.set("priceRupees", p.priceRupees);
    fd.set("bufferBeforeMin", String(p.bufferBeforeMin));
    fd.set("bufferAfterMin", String(p.bufferAfterMin));
    fd.set("minNoticeMin", String(p.minNoticeMin));
    fd.set("slotIntervalMin", String(p.slotIntervalMin));
    if (p.freqLimit.per_day) fd.set("per_day", String(p.freqLimit.per_day));
    if (p.freqLimit.per_week) fd.set("per_week", String(p.freqLimit.per_week));
    if (p.freqLimit.per_month) fd.set("per_month", String(p.freqLimit.per_month));
    await quickSavePackageAction({}, fd);
    setSavingId(null);
  }

  async function toggleActive(p: WsPackage) {
    setPkg(p.id, { isActive: !p.isActive });
    const fd = new FormData();
    fd.set("id", p.id);
    fd.set("isActive", String(!p.isActive));
    await setPackageActiveAction(fd);
  }

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setLayer("preview")}>
        Preview your landing page
      </Button>

      {/* Backdrop */}
      <div
        onClick={() => setLayer((l) => (l === "edit" ? "preview" : "closed"))}
        className={`fixed inset-0 z-30 bg-night/40 transition-opacity duration-300 ${layer !== "closed" ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden
      />

      {/* Layer 1 — public page preview */}
      <section
        className={`fixed inset-y-0 right-0 z-40 flex w-full flex-col bg-sand shadow-2xl transition-transform duration-300 lg:w-[68vw] lg:max-w-[920px] ${layer !== "closed" ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={layer === "closed"}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-3">
          <h2 className="font-display text-lg text-ink">Your landing page</h2>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" className="h-9 py-0 text-sm" onClick={() => { setTab("profile"); setLayer("edit"); }}>
              Edit profile &amp; packages
            </Button>
            <button type="button" aria-label="Close" onClick={() => setLayer("closed")} className="grid h-9 w-9 place-items-center rounded-control text-muted hover:bg-sand-2/60">✕</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <PublicBookingPage
            profile={{ displayName: prof.displayName, bio: prof.bio, specialities: prof.specialities }}
            branding={branding}
            packages={previewPackages}
          />
        </div>
      </section>

      {/* Layer 2 — edit workspace */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl transition-transform duration-300 lg:w-[44vw] lg:max-w-[480px] ${layer === "edit" ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={layer !== "edit"}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="inline-flex rounded-control border border-line p-1">
            <button type="button" onClick={() => setTab("profile")} className={`rounded-[7px] px-3 py-1.5 text-sm transition ${tab === "profile" ? "bg-marigold text-night" : "text-muted hover:text-ink"}`}>Profile</button>
            <button type="button" onClick={() => setTab("packages")} className={`rounded-[7px] px-3 py-1.5 text-sm transition ${tab === "packages" ? "bg-marigold text-night" : "text-muted hover:text-ink"}`}>Packages</button>
          </div>
          <button type="button" aria-label="Back to preview" onClick={() => setLayer("preview")} className="grid h-9 w-9 place-items-center rounded-control text-muted hover:bg-sand-2/60">✕</button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
          {tab === "profile" ? (
            <>
              <p className="text-xs text-muted">Edits update the preview live. Logo, theme &amp; full bio live in Settings.</p>
              <Input label="Display name" value={prof.displayName} onChange={(e) => setProf((s) => ({ ...s, displayName: e.target.value }))} />
              <label className="block">
                <span className="mb-1.5 block text-sm text-muted">Bio</span>
                <textarea rows={4} value={prof.bio} onChange={(e) => setProf((s) => ({ ...s, bio: e.target.value }))} className={textareaClass} />
              </label>
              <MultiSelect
                name="specialities"
                label="Specialities"
                options={SPECIALITY_OPTIONS}
                defaultValue={prof.specialities}
                onChange={(v) => setProf((s) => ({ ...s, specialities: v }))}
              />
              {profileMsg && <p className={`text-sm ${profileMsg === "Saved." ? "text-green" : "text-terra"}`}>{profileMsg}</p>}
              <Button type="button" onClick={saveProfile} disabled={savingProfile}>{savingProfile ? "Saving…" : "Save profile"}</Button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted">Quick-edit title, price &amp; active. Use the full editor for durations, limits &amp; description.</p>
              {pkgs.length === 0 ? (
                <p className="text-sm text-muted">No packages yet.</p>
              ) : (
                pkgs.map((p) => (
                  <div key={p.id} className="rounded-card border border-line p-3">
                    <Input label="Title" value={p.title} onChange={(e) => setPkg(p.id, { title: e.target.value })} />
                    <div className="mt-2">
                      <Input label="Price (₹)" type="number" min="0" value={p.priceRupees} onChange={(e) => setPkg(p.id, { priceRupees: e.target.value })} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => toggleActive(p)} className="rounded-control border border-line px-3 py-1.5 text-sm text-ink transition hover:border-marigold">
                        {p.isActive ? "Active ✓" : "Inactive"}
                      </button>
                      <Link href={`/dashboard/packages/${p.id}`} className="rounded-control border border-line px-3 py-1.5 text-sm text-ink transition hover:border-marigold">
                        Full editor
                      </Link>
                      <Button type="button" className="ml-auto h-9 py-0 text-sm" onClick={() => savePackage(p)} disabled={savingId === p.id}>
                        {savingId === p.id ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

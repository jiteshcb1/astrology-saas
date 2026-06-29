"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DICT, LANGS, type HomeCopy, type Lang } from "@/components/home/i18n";
import { TESTIMONIALS } from "@/components/home/testimonials";
import { MonogramAvatar } from "@/components/home/MonogramAvatar";
import { Reveal } from "@/components/home/motion";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { submitLeadAction, type LeadFormState } from "@/app/(marketing)/lead-actions";
import { checkClaimAvailabilityAction } from "@/app/(marketing)/claim-actions";

// ── i18n context ──────────────────────────────────────────────────────────────
interface HomeCtx { t: HomeCopy; lang: Lang; setLang: (l: Lang) => void }
const Ctx = createContext<HomeCtx | null>(null);
const useHome = () => useContext(Ctx)!;

export interface DbMonthly { starter?: number; pro?: number; max?: number }

// ── shared bits ───────────────────────────────────────────────────────────────
const COSMOS = "#0b1026";
function inr(n: number) { return n.toLocaleString("en-IN"); }
function slugify(s: string) { return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }

function SunMark({ className = "" }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className={className} aria-hidden>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M20 4l-2 2M6 18l-2 2" strokeLinecap="round" />
    </svg>
  );
}
function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}
function Eyebrow({ children, center = true }: { children: ReactNode; center?: boolean }) {
  return <p className={`text-xs font-semibold uppercase tracking-[0.2em] text-aurora-soft ${center ? "text-center" : ""}`}>{children}</p>;
}
function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-3 text-center font-display text-3xl font-semibold leading-tight text-moonstone sm:text-4xl">{children}</h2>;
}

// NAV — the shared SiteHeader (see components/marketing/SiteHeader.tsx) is rendered in the root below, so the
// home page and every marketing page share one identical header. The language toggle is wired via the i18n prop.

// ── HERO (aurora veil + snowy-star parallax) ────────────────────────────────
const STARS = Array.from({ length: 60 }, (_, i) => ({ l: (i * 53) % 100, t: (i * 37) % 100, d: (i % 5) * 0.8, s: 0.6 + ((i * 7) % 10) / 10 }));
// Deterministic snowy-star layers (integer math → no SSR/client hydration drift).
function mkStars(n: number, a: number, b: number, c: number) {
  return Array.from({ length: n }, (_, i) => ({ l: (i * a) % 100, t: (i * b) % 100, s: 0.6 + ((i * c) % 10) / 10, d: (i % 5) * 0.7, gold: i % 8 === 0 }));
}
const STAR_LAYERS = [mkStars(42, 53, 37, 7), mkStars(28, 71, 29, 11), mkStars(16, 97, 41, 17)];
const LAYER_DEPTHS = [10, 6, 14, 24]; // veil, then far/mid/near star layers
function Hero() {
  const { t } = useHome();
  const heroRef = useRef<HTMLElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (reduce || !fine) return;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const onMove = (e: MouseEvent) => {
      const r = hero.getBoundingClientRect();
      tx = (e.clientX - r.width / 2) / r.width;
      ty = (e.clientY - r.top - r.height / 2) / r.height;
    };
    const loop = () => {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      layerRefs.current.forEach((el, i) => {
        if (el) el.style.transform = `translate3d(${(-cx * LAYER_DEPTHS[i]).toFixed(2)}px, ${(-cy * LAYER_DEPTHS[i]).toFixed(2)}px, 0)`;
      });
      raf = requestAnimationFrame(loop);
    };
    hero.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(loop);
    return () => { hero.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);
  // Sample-4 audience switch: "astro" is the default (the page funnel is astrologer-facing); seeker is opt-in.
  const router = useRouter();
  const [aud, setAud] = useState<"seeker" | "astro">("astro");
  const [q, setQ] = useState("");
  const locked = aud === "seeker"; // seeker (astrologer search) ships in Phase 2 — locked for now
  const copy = aud === "astro"
    ? { h1Pre: t.hero.h1Pre, h1Em: t.hero.h1Em, h1Post: t.hero.h1Post, sub: t.hero.sub, note: t.hero.note }
    : { h1Pre: t.hero2.seeker.h1Pre, h1Em: t.hero2.seeker.h1Em, h1Post: t.hero2.seeker.h1Post, sub: t.hero2.seeker.sub, note: t.hero2.seeker.note };
  const search = aud === "astro" ? t.hero2.astro : { placeholder: t.hero2.seeker.placeholder, button: t.hero2.seeker.button };
  const claimSlug = aud === "astro" ? slugify(q) : "";
  // Live "is this jyoti.app/<slug> available?" check — debounced, reuses the canonical org-slug lookup.
  const [avail, setAvail] = useState<"idle" | "checking" | "available" | "taken">("idle");
  useEffect(() => {
    if (aud !== "astro" || !claimSlug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset/pending are intentional client-only state
      setAvail("idle");
      return;
    }
    setAvail("checking");
    const id = setTimeout(() => {
      checkClaimAvailabilityAction(claimSlug).then((r) => setAvail(r.available ? "available" : "taken")).catch(() => setAvail("idle"));
    }, 350);
    return () => clearTimeout(id);
  }, [claimSlug, aud]);
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    if (locked) return; // seeker search is locked → Phase 2
    // claim a jyoti.app/<slug> handle → carry it into sign-up
    router.push(claimSlug ? `/signin?claim=${encodeURIComponent(claimSlug)}` : "/signin");
  };
  return (
    <header ref={heroRef} className="relative overflow-hidden px-6 pb-28 pt-24 text-center" style={{ background: "radial-gradient(ellipse at 50% -10%, #2d1b4e 0%, #14122b 45%, #0b1026 100%)" }}>
      {/* aurora veil — vertical lens glow, gently pulsing */}
      <div ref={(el) => { layerRefs.current[0] = el; }} aria-hidden className="pointer-events-none absolute inset-0 will-change-transform">
        <div className="hero-veil absolute left-1/2 top-1/2" style={{ width: "min(560px, 82vw)", height: "min(740px, 92%)", background: "radial-gradient(ellipse 42% 50% at 50% 50%, rgba(124,92,255,0.55), rgba(255,143,177,0.2) 44%, rgba(124,92,255,0) 72%)", filter: "blur(58px)" }} />
      </div>
      {/* snowy star layers (mouse parallax at different depths) */}
      {STAR_LAYERS.map((layer, li) => (
        <div key={li} ref={(el) => { layerRefs.current[li + 1] = el; }} aria-hidden className="pointer-events-none absolute inset-0 will-change-transform">
          {layer.map((s, i) => (
            <span key={i} className={`absolute rounded-full ${s.gold ? "bg-gold" : "bg-moonstone"}`} style={{ left: `${s.l}%`, top: `${s.t}%`, width: s.s * 2, height: s.s * 2, opacity: 0.5, boxShadow: s.gold ? "0 0 6px 1px rgba(232,163,61,0.5)" : undefined, animation: `twinkle 5s ease-in-out ${s.d}s infinite` }} />
          ))}
        </div>
      ))}
      <div className="relative z-[2] mx-auto max-w-3xl">
        {/* audience switch */}
        <div className="inline-flex gap-1 rounded-full border border-line-cosmos bg-white/[0.04] p-1 backdrop-blur-md">
          {(["astro", "seeker"] as const).map((a) => (
            <button key={a} type="button" onClick={() => { setAud(a); setQ(""); }} aria-pressed={aud === a}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${aud === a ? "bg-aurora/20 text-moonstone ring-1 ring-aurora/50" : "text-stardust hover:text-moonstone"}`}>
              {a === "seeker" ? t.hero2.tabs.seeker : t.hero2.tabs.astro}
            </button>
          ))}
        </div>
        <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.07] tracking-tight text-moonstone sm:text-6xl">
          {copy.h1Pre}<em className="not-italic text-gold">{copy.h1Em}</em>{copy.h1Post}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-stardust sm:text-lg">{copy.sub}</p>
        {aud === "astro" && <p className="mx-auto mt-7 max-w-md text-sm text-moonstone/90">{t.hero2.claim.caption}</p>}
        {/* search (seeker) / claim-your-link (astrologer) — morphs with the switch */}
        <form onSubmit={onSearch} className={`mx-auto flex w-full max-w-xl items-center gap-2 rounded-full border border-line-cosmos py-1.5 pl-4 pr-1.5 backdrop-blur-md transition ${aud === "astro" ? "mt-3" : "mt-8"} ${locked ? "bg-white/[0.03]" : "bg-white/[0.06] focus-within:border-aurora"}`}>
          {aud === "astro" && <span className="shrink-0 select-none text-sm text-stardust">jyoti.app/</span>}
          {locked && <LockIcon className="shrink-0 text-stardust" />}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={search.placeholder} aria-label={search.placeholder}
            autoComplete="off" spellCheck={false} disabled={locked}
            className="min-w-0 flex-1 bg-transparent text-sm text-moonstone outline-none placeholder:text-stardust disabled:cursor-not-allowed" />
          <button type="submit" disabled={locked} aria-label={locked ? t.hero2.soon : search.button}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition ${locked ? "cursor-not-allowed bg-aurora/40" : "bg-aurora hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(124,92,255,0.45)]"}`}>
            {locked && <LockIcon />}{search.button}
          </button>
        </form>
        {aud === "astro" && claimSlug && (
          <p className="mt-2.5 text-xs" aria-live="polite">
            {avail === "checking" && <span className="text-stardust">{t.hero2.claim.checking}</span>}
            {avail === "available" && <span className="font-medium text-green">jyoti.app/{claimSlug} {t.hero2.claim.available}</span>}
            {avail === "taken" && <span className="font-medium text-nebula">jyoti.app/{claimSlug} {t.hero2.claim.taken}</span>}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
          <span className={locked ? "inline-flex items-center gap-1.5 text-gold/90" : "text-stardust/70"}>
            {locked && <LockIcon className="h-3 w-3" />}{locked ? t.hero2.soon : copy.note}
          </span>
          <Link href="/demo" className="font-medium text-aurora-soft transition hover:text-moonstone">{t.hero2.demo}</Link>
        </div>
      </div>
      {/* orbit stats */}
      <div className="relative z-[2] mx-auto mt-16 flex max-w-3xl flex-wrap justify-center gap-4">
        {(["100%", "3", "0", "∞"] as const).map((v, i) => (
          <div key={i} className="min-w-[140px] rounded-card border border-line-cosmos bg-white/[0.04] px-7 py-5 transition hover:-translate-y-1.5 hover:border-aurora hover:bg-aurora/10">
            <b className="block font-clash text-3xl leading-none text-gold">{v}</b>
            <span className="mt-1 block text-sm text-stardust">{t.orbits[i]}</span>
          </div>
        ))}
      </div>
    </header>
  );
}

// ── MONEY BAND (count-up) ───────────────────────────────────────────────────
function MoneyBand() {
  const { t } = useHome();
  return (
    <section className="relative overflow-hidden px-6 py-24 text-center" style={{ background: "radial-gradient(ellipse 90% 65% at 50% 0%, #241544 0%, #16132f 46%, #0b1026 100%)" }}>
      {/* soft aurora halo behind the ₹0 */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[42%] h-[440px] w-[440px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(circle, rgba(124,92,255,0.3), rgba(255,143,177,0.1) 46%, transparent 70%)", filter: "blur(44px)" }} />
      <div className="relative mx-auto max-w-3xl">
        <Eyebrow>{t.money.eyebrow}</Eyebrow>
        <div className="mt-4 font-clash text-7xl font-semibold text-gold sm:text-8xl" style={{ textShadow: "0 0 44px rgba(232,163,61,0.35)" }}>₹0</div>
        <p className="mt-3 text-lg font-medium text-moonstone">{t.money.zeroLabel}</p>
        <p className="mx-auto mt-4 max-w-xl text-stardust">{t.money.body}</p>
        <p className="mt-6 font-display text-2xl font-semibold text-gold">{t.money.gold}</p>
      </div>
    </section>
  );
}

// ── PAIN → SOLUTION ─────────────────────────────────────────────────────────
function PainSolution() {
  const { t } = useHome();
  return (
    <section className="bg-cosmos px-6 py-20">
      <Reveal><SectionTitle>{t.pain.title}</SectionTitle></Reveal>
      <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-card border border-line-cosmos">
        <div className="grid grid-cols-2 bg-white/[0.03] text-sm font-semibold">
          <div className="px-5 py-3 text-stardust">{t.pain.colMarket}</div>
          <div className="px-5 py-3 text-aurora-soft">{t.pain.colYours}</div>
        </div>
        {t.pain.rows.map((r, i) => (
          <div key={i} className="grid grid-cols-2 border-t border-line-cosmos text-sm">
            <div className="flex items-start gap-2 px-5 py-3.5 text-stardust">
              <span className="mt-0.5 text-terra">✕</span>{r.market}
            </div>
            <div className="flex items-start gap-2 border-l border-line-cosmos px-5 py-3.5 text-moonstone">
              <span className="mt-0.5 text-aurora">✓</span>{r.yours}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── HOW IT WORKS (timeline) ─────────────────────────────────────────────────
function Timeline() {
  const { t } = useHome();
  return (
    <section className="bg-cosmos px-6 py-20">
      <Reveal>
        <Eyebrow>{t.how.eyebrow}</Eyebrow>
        <SectionTitle>{t.how.title}</SectionTitle>
        <p className="mx-auto mt-3 max-w-xl text-center text-stardust">{t.how.lead}</p>
      </Reveal>
      <div className="relative mx-auto mt-12 max-w-2xl">
        <div className="absolute bottom-3 left-[31px] top-3 w-0.5" style={{ background: "linear-gradient(#7c5cff, #ff8fb1)", opacity: 0.4 }} />
        {t.how.steps.map((s, i) => (
          <Reveal key={i}>
            <div className="group flex items-start gap-6 py-4">
              <span className="z-[1] grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-aurora bg-cosmos font-clash text-xl text-gold transition group-hover:bg-aurora group-hover:text-white">{i + 1}</span>
              <div className="pt-2">
                <h3 className="font-display text-xl font-semibold text-moonstone">{s.title}</h3>
                <p className="mt-1 text-stardust">{s.body}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ── FEATURES (interactive selector) ─────────────────────────────────────────
const FEAT_ICONS = [
  <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" strokeLinecap="round" /></>,
  <><path d="M2 7h20v11H2zM2 11h20" strokeLinecap="round" /><circle cx="7" cy="15" r="1.2" fill="currentColor" stroke="none" /></>,
  <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-5.6 6.5-5.6s6.5 2 6.5 5.6M16 8l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></>,
  <><path d="M4 4h16v13H7l-3 3z" strokeLinejoin="round" /><path d="M8 9h8M8 13h5" strokeLinecap="round" /></>,
];
function FeatureSelector() {
  const { t } = useHome();
  const [active, setActive] = useState(0);
  const cur = t.features.items[active];
  return (
    <section className="px-6 py-20" style={{ background: "linear-gradient(180deg, #0b1026, #16112e)" }}>
      <Reveal>
        <Eyebrow>{t.features.eyebrow}</Eyebrow>
        <SectionTitle>{t.features.title}</SectionTitle>
        <p className="mx-auto mt-3 max-w-xl text-center text-stardust">{t.features.lead}</p>
      </Reveal>
      <div className="mx-auto mt-12 grid max-w-5xl items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-2.5">
          {t.features.items.map((f, i) => (
            <button key={i} type="button" onClick={() => setActive(i)} className={`rounded-card border p-5 text-left transition ${active === i ? "border-aurora bg-white/[0.05] shadow-[0_14px_34px_rgba(124,92,255,0.15)]" : "border-line-cosmos hover:border-aurora/50"}`}>
              <h4 className="flex items-center gap-3 font-display text-lg font-medium text-moonstone">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={active === i ? "text-aurora" : "text-stardust"}>{FEAT_ICONS[i]}</svg>
                {f.title}
              </h4>
              {active === i && <p className="mt-2.5 text-sm text-stardust">{f.body}</p>}
            </button>
          ))}
        </div>
        <div className="relative grid min-h-[320px] place-items-center overflow-hidden rounded-card border border-line-cosmos bg-cosmos p-8">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {STARS.slice(0, 24).map((s, i) => <span key={i} className="absolute rounded-full bg-gold/70" style={{ left: `${s.l}%`, top: `${s.t}%`, width: 2, height: 2 }} />)}
          </div>
          <div key={active} className="relative z-[1] w-full max-w-xs rounded-card border border-line-cosmos bg-white/[0.05] p-6">
            <span className="text-aurora"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{FEAT_ICONS[active]}</svg></span>
            <h5 className="mt-3 font-display text-xl font-medium text-moonstone">{cur.title}</h5>
            <p className="mt-2 text-sm text-stardust">{cur.body}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── TESTIMONIALS ────────────────────────────────────────────────────────────
function Testimonials() {
  const { t } = useHome();
  return (
    <section className="bg-cosmos px-6 py-20">
      <Reveal>
        <Eyebrow>{t.testi.eyebrow}</Eyebrow>
        <SectionTitle>{t.testi.title}</SectionTitle>
      </Reveal>
      <div className="mx-auto mt-12 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TESTIMONIALS.map((tm) => (
          <Reveal key={tm.name}>
            <figure className="flex h-full flex-col rounded-card border border-line-cosmos bg-white/[0.04] p-6">
              <blockquote className="flex-1 font-display text-[1.02rem] italic leading-relaxed text-moonstone/90">&ldquo;{tm.quote}&rdquo;</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <MonogramAvatar name={tm.name} />
                <div>
                  <div className="font-medium text-moonstone">{tm.name}</div>
                  <div className="text-xs text-stardust">{tm.specialty} · {tm.city}</div>
                </div>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-stardust/60">{t.testi.footnote}</p>
    </section>
  );
}

// ── SCHEDULE A CALL (wired to SP-6.3 lead action) ───────────────────────────
function ScheduleCall() {
  const { t } = useHome();
  const [state, action, pending] = useActionState<LeadFormState, FormData>(submitLeadAction, {});
  const [language, setLanguage] = useState("Hindi");
  const [slot, setSlot] = useState(""); // "YYYY-MM-DDTHH:mm" preferred call time (shared DateTimePicker)
  const [minDT, setMinDT] = useState<string | undefined>(undefined); // set post-mount → no SSR/now hydration drift
  useEffect(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentionally derive "now" on the client only
    setMinDT(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`);
  }, []);
  const fieldCls = "w-full rounded-control border border-line-cosmos bg-cosmos/60 px-3.5 py-2.5 text-sm text-moonstone outline-none focus:border-aurora";
  const slotLabel = slot ? new Date(slot).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "no preference";
  const message = `Walkthrough call request (source: walkthrough_call) · Preferred language: ${language} · Slot: ${slotLabel}`;
  return (
    <section className="px-6 py-20" style={{ background: "radial-gradient(ellipse at 20% 20%, #2d1b4e, #0b1026)" }}>
      <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <Eyebrow center={false}>{t.call.eyebrow}</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-semibold text-moonstone sm:text-4xl">{t.call.title}</h2>
          <p className="mt-4 text-stardust">{t.call.lead}</p>
          <div className="mt-6 flex flex-col gap-3">
            {t.call.points.map((p, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm text-moonstone/90">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth="2.4" className="shrink-0"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>{p}
              </div>
            ))}
          </div>
        </Reveal>
        <div className="rounded-card border border-line-cosmos bg-white/[0.05] p-7">
          {state.ok ? (
            <div className="py-10 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-aurora/20 text-aurora"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <p className="mt-4 text-moonstone">{t.call.success}</p>
            </div>
          ) : (
            <form action={action} className="space-y-3.5">
              <input type="hidden" name="message" value={message} />
              <h3 className="font-display text-xl font-medium text-moonstone">{t.call.formTitle}</h3>
              <p className="-mt-1 text-sm text-stardust">{t.call.formSub}</p>
              <label className="block"><span className="mb-1.5 block text-xs text-stardust">{t.call.name}</span><input name="name" required className={fieldCls} placeholder="Pandit Ravi Sharma" /></label>
              <label className="block"><span className="mb-1.5 block text-xs text-stardust">{t.call.email}</span><input name="email" type="email" required className={fieldCls} placeholder="you@example.com" /></label>
              <label className="block"><span className="mb-1.5 block text-xs text-stardust">{t.call.phone}</span><input name="whatsapp" required inputMode="tel" className={fieldCls} placeholder="+91 98XXX XXXXX" /></label>
              <label className="block"><span className="mb-1.5 block text-xs text-stardust">{t.call.language}</span>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className={fieldCls}><option>Hindi</option><option>English</option><option>Hinglish</option></select>
              </label>
              <label className="block"><span className="mb-1.5 block text-xs text-stardust">{t.call.slot}</span>
                <DateTimePicker tone="celestial" value={slot} onChange={setSlot} min={minDT} datePlaceholder="Pick a date" timePlaceholder="Time" />
              </label>
              {state.error && <p className="text-sm text-terra">{state.error}</p>}
              <button type="submit" disabled={pending} className="w-full rounded-full bg-aurora px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60">{pending ? t.call.sending : t.call.submit}</button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ── MODALITIES ──────────────────────────────────────────────────────────────
const MOD_GRAD = ["#7c5cff,#ff8fb1", "#e8a33d,#7c5cff", "#ff8fb1,#a78bff", "#a78bff,#7c5cff", "#e8a33d,#ff8fb1", "#7c5cff,#2d1b4e"];
function Modalities() {
  const { t } = useHome();
  return (
    <section className="bg-cosmos px-6 py-20">
      <Reveal><Eyebrow>{t.modalities.eyebrow}</Eyebrow><SectionTitle>{t.modalities.title}</SectionTitle></Reveal>
      <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3">
        {t.modalities.items.map((m, i) => (
          <div key={i} className="rounded-card border border-line-cosmos p-6 text-center transition hover:-translate-y-1" style={{ background: `linear-gradient(135deg, ${MOD_GRAD[i].split(",")[0]}22, ${MOD_GRAD[i].split(",")[1]}11)` }}>
            <span className="mx-auto block h-9 w-9 rounded-full" style={{ background: `linear-gradient(135deg, ${MOD_GRAD[i]})` }} />
            <div className="mt-3 font-display text-lg font-medium text-moonstone">{m}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── PRICING TEASER ──────────────────────────────────────────────────────────
function PricingTeaser({ dbMonthly }: { dbMonthly: DbMonthly }) {
  const { t } = useHome();
  const plans = [
    { name: "Starter", monthly: 0, free: true, featured: false, tag: t.pricing.taglines[0] },
    { name: "Pro", monthly: dbMonthly.pro ?? 799, free: false, featured: false, tag: t.pricing.taglines[1] },
    { name: "Max", monthly: dbMonthly.max ?? 1999, free: false, featured: true, tag: t.pricing.taglines[2] },
    { name: "Enterprise", monthly: null as number | null, free: false, featured: false, tag: t.pricing.taglines[3] },
  ];
  return (
    <section className="bg-cosmos px-6 py-20">
      <Reveal><Eyebrow>{t.pricing.eyebrow}</Eyebrow><SectionTitle>{t.pricing.title}</SectionTitle><p className="mx-auto mt-3 max-w-xl text-center text-stardust">{t.pricing.lead}</p></Reveal>
      <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => (
          <div key={p.name} className={`flex flex-col rounded-card border bg-white/[0.04] p-6 ${p.featured ? "border-aurora shadow-[0_18px_44px_rgba(124,92,255,0.2)]" : "border-line-cosmos"}`}>
            <h3 className="font-display text-lg font-semibold text-moonstone">{p.name}</h3>
            <div className="mt-2 font-clash text-3xl font-semibold text-moonstone">
              {p.name === "Enterprise" ? <span className="text-2xl text-aurora-soft">{t.pricing.contact}</span> : p.free ? t.pricing.free : <>₹{inr(p.monthly!)}<span className="text-sm font-normal text-stardust">{t.pricing.perMonth}</span></>}
            </div>
            <p className="mt-2 flex-1 text-xs text-stardust">{p.tag}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link href="/pricing" className="inline-block rounded-full border border-aurora px-6 py-3 text-sm font-semibold text-aurora-soft transition hover:bg-aurora hover:text-white">{t.pricing.seeFull}</Link>
      </div>
    </section>
  );
}

// ── DEMO DASHBOARD ──────────────────────────────────────────────────────────
function DemoBand() {
  const { t } = useHome();
  return (
    <section className="bg-cosmos px-6 py-20">
      <Reveal>
        <div className="relative mx-auto max-w-2xl overflow-hidden rounded-card border border-line-cosmos bg-white/[0.05] p-12 text-center">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full" style={{ background: "radial-gradient(#7c5cff, transparent 70%)", opacity: 0.35 }} />
          <Eyebrow>{t.demo.eyebrow}</Eyebrow>
          <h2 className="relative mt-3 font-display text-3xl font-semibold text-moonstone">{t.demo.title}</h2>
          <p className="relative mx-auto mt-3 max-w-md text-stardust">{t.demo.lead}</p>
          <Link href="/demo" className="relative mt-7 inline-block rounded-full bg-aurora px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5">{t.demo.btn}</Link>
          <p className="relative mt-4 text-xs text-stardust/70">{t.demo.note}</p>
        </div>
      </Reveal>
    </section>
  );
}

// ── FAQ ─────────────────────────────────────────────────────────────────────
function Faq() {
  const { t } = useHome();
  return (
    <section className="bg-cosmos px-6 py-20">
      <Reveal><SectionTitle>{t.faq.title}</SectionTitle></Reveal>
      <div className="mx-auto mt-8 max-w-2xl space-y-3">
        {t.faq.items.map((f) => (
          <details key={f.q} className="group rounded-card border border-line-cosmos bg-white/[0.04] px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-moonstone">{f.q}<span className="shrink-0 text-aurora transition group-open:rotate-45">+</span></summary>
            <p className="mt-3 text-sm text-stardust">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ── FINAL CTA ───────────────────────────────────────────────────────────────
function FinalCta() {
  const { t } = useHome();
  return (
    <section className="relative overflow-hidden px-6 py-24 text-center" style={{ background: "radial-gradient(ellipse at 50% 120%, #7c5cff 0%, #2d1b4e 45%, #0b1026 100%)" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {STARS.slice(0, 30).map((s, i) => <span key={i} className="absolute rounded-full bg-gold" style={{ left: `${s.l}%`, top: `${s.t}%`, width: 2, height: 2, animation: `twinkle 4s ease-in-out ${s.d}s infinite` }} />)}
      </div>
      <div className="relative mx-auto max-w-2xl">
        <h2 className="font-display text-3xl font-semibold text-moonstone sm:text-5xl">{t.final.title}</h2>
        <p className="mx-auto mt-4 max-w-md text-stardust">{t.final.sub}</p>
        <Link href="/signin" className="mt-8 inline-block rounded-full bg-gold px-8 py-3.5 text-sm font-bold text-cosmos transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(232,163,61,0.4)]">{t.final.btn}</Link>
        <p className="mt-4 text-xs text-stardust/70">{t.final.micro}</p>
      </div>
    </section>
  );
}

// ── FOOTER ──────────────────────────────────────────────────────────────────
function Footer() {
  const { t } = useHome();
  return (
    <footer className="border-t border-line-cosmos px-6 py-14" style={{ background: COSMOS }}>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-10 border-b border-line-cosmos pb-8">
        <div className="flex items-center gap-2 font-display text-lg font-semibold text-moonstone"><span className="text-aurora"><SunMark /></span>Jyoti</div>
        <div><h6 className="font-display text-sm text-moonstone">{t.footer.colProduct}</h6><div className="mt-3 space-y-2 text-sm"><Link href="/how-it-works" className="block text-stardust hover:text-aurora-soft">{t.nav.howItWorks}</Link><Link href="/features" className="block text-stardust hover:text-aurora-soft">{t.nav.features}</Link><Link href="/pricing" className="block text-stardust hover:text-aurora-soft">{t.nav.pricing}</Link></div></div>
        <div><h6 className="font-display text-sm text-moonstone">{t.footer.colAstro}</h6><div className="mt-3 space-y-2 text-sm"><Link href="/get-started" className="block text-stardust hover:text-aurora-soft">{t.footer.getStarted}</Link><Link href="/for-astrologers" className="block text-stardust hover:text-aurora-soft">{t.footer.examples}</Link><Link href="/for-astrologers" className="block text-stardust hover:text-aurora-soft">{t.footer.support}</Link></div></div>
        <div><h6 className="font-display text-sm text-moonstone">{t.footer.colCompany}</h6><div className="mt-3 space-y-2 text-sm"><Link href="/about" className="block text-stardust hover:text-aurora-soft">{t.footer.about}</Link><Link href="/privacy" className="block text-stardust hover:text-aurora-soft">{t.footer.privacy}</Link><Link href="/terms" className="block text-stardust hover:text-aurora-soft">{t.footer.terms}</Link></div></div>
      </div>
      <p className="mx-auto mt-6 max-w-6xl text-xs text-stardust/60">© 2026 Jyoti · {t.footer.note}</p>
    </footer>
  );
}

// ── ROOT ────────────────────────────────────────────────────────────────────
export function HomeClient({ dbMonthly }: { dbMonthly: DbMonthly }) {
  const [lang, setLang] = useState<Lang>("en");
  const t = DICT[lang];
  return (
    <Ctx.Provider value={{ t, lang, setLang }}>
      <div className={`celestial min-h-screen ${lang === "hi" ? "font-deva" : ""}`}>
        <SiteHeader i18n={{ lang, langs: LANGS, onLang: (c) => setLang(c as Lang) }} />
        <main>
          <Hero />
          <MoneyBand />
          <PainSolution />
          <Timeline />
          <FeatureSelector />
          <Testimonials />
          <ScheduleCall />
          <Modalities />
          <PricingTeaser dbMonthly={dbMonthly} />
          <DemoBand />
          <Faq />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </Ctx.Provider>
  );
}

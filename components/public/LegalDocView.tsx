import { readableTextOn } from "@/lib/branding";

// Shared branded renderer for a legal document (consultant or platform). HTML is sanitized at write time.
export interface LegalView {
  title: string;
  html: string;
  updatedAtISO: string | null;
  brandName: string;
  themeColor: string | null;
  logoUrl: string | null;
  backHref?: string;
  backLabel?: string;
}

const PROSE =
  "text-[0.95rem] leading-relaxed text-ink [&_h2]:mt-5 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-ink [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_a]:text-terra [&_a]:underline [&_a]:break-words [&_strong]:font-semibold [&_em]:italic";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function LegalDocView({ view }: { view: LegalView }) {
  const accent = view.themeColor || "#14122b";
  const onAccent = readableTextOn(accent);
  const initial = (view.brandName.trim()[0] ?? "A").toUpperCase();

  return (
    <div className="min-h-screen bg-sand">
      <header className="px-6 py-8" style={{ backgroundColor: accent, color: onAccent }}>
        <div className="mx-auto max-w-2xl">
          {view.backHref && (
            <a href={view.backHref} style={{ borderColor: `${onAccent}55` }} className="mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm opacity-90 transition hover:opacity-100">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {view.backLabel ?? "Back"}
            </a>
          )}
          <div className="flex items-center gap-3">
            {view.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={view.logoUrl} alt={view.brandName} className="h-10 w-10 rounded-full bg-white object-cover" />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white font-display" style={{ color: accent }}>{initial}</span>
            )}
            <span className="font-display text-base">{view.brandName}</span>
          </div>
          <h1 className="mt-3 font-display text-3xl">{view.title}</h1>
          {view.updatedAtISO && <p className="mt-1 text-sm opacity-85">Last updated {fmtDate(view.updatedAtISO)}</p>}
        </div>
      </header>

      <article className="mx-auto max-w-2xl px-6 py-8">
        <div className={PROSE} dangerouslySetInnerHTML={{ __html: view.html }} />
      </article>
    </div>
  );
}

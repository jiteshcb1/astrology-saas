import type { ReactNode } from "react";
import { CelestialHeader } from "@/components/marketing/CelestialHeader";

// SP-6.1 — shared shell for the placeholder Terms/Privacy pages. Content is illustrative only; each renders a
// prominent "placeholder — consult a lawyer" disclaimer (verbatim from the mockups).
export interface LegalSection {
  id: string;
  heading: string;
  content: ReactNode;
}

export function Highlight({ children }: { children: ReactNode }) {
  return <div className="rounded-control border-l-4 border-marigold bg-marigold/10 px-4 py-3 text-sm text-ink">{children}</div>;
}

export function LegalDoc({ title, updated, disclaimer, sections }: { title: string; updated: string; disclaimer: string; sections: LegalSection[] }) {
  return (
    <>
      <CelestialHeader title={<>{title}</>} subtitle={`Last updated: ${updated}`} />
      <section className="bg-sand">
        <div className="mx-auto w-full max-w-3xl px-6 py-16">
          <div className="flex gap-3 rounded-card border border-terra/40 bg-terra/10 p-4 text-sm text-ink">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b9543a" strokeWidth="1.8" className="mt-0.5 shrink-0" aria-hidden>
              <path d="M12 3l9 16H3z M12 10v4 M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p><strong>Placeholder document.</strong> {disclaimer}</p>
          </div>

          <nav className="mt-8 rounded-card border border-line bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">On this page</h2>
            <ol className="mt-3 space-y-1.5 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}><a href={`#${s.id}`} className="text-terra hover:underline">{i + 1}. {s.heading}</a></li>
              ))}
            </ol>
          </nav>

          <div className="mt-10 space-y-10">
            {sections.map((s, i) => (
              <div key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="font-display text-xl text-ink">{i + 1}. {s.heading}</h2>
                <div className="mt-2 space-y-3 text-sm text-muted">{s.content}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

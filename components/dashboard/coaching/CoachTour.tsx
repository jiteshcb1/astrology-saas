"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { TOURS, type CoachArea, type CoachStep } from "./tours";
import { useCoach } from "./CoachProvider";

// First-run coach marks for one dashboard area. Renders (via portal) a soft backdrop dim with a spotlight
// cutout around the current target + a card. Non-blocking (the dim doesn't capture clicks), skippable,
// keyboard-navigable, and shown only the first time the area is visited.
const PAD = 8;

export function CoachTour({ area }: { area: CoachArea }) {
  const { isSeen, markSeen } = useCoach();
  const steps = TOURS[area] ?? [];
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<Element | null>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only mount guard for createPortal
    setMounted(true);
  }, []);

  // Start once (after the DOM settles) when this area hasn't been seen.
  useEffect(() => {
    if (!steps.length || isSeen(area)) return;
    const t = setTimeout(() => {
      prevFocus.current = document.activeElement;
      setI(0);
      setOpen(true);
    }, 400);
    return () => clearTimeout(t);
  }, [area, isSeen, steps.length]);

  const step: CoachStep | undefined = steps[i];

  // Track the current target's rect (recompute on resize/scroll/late layout).
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      if (!step?.target) { setRect(null); return; }
      const el = document.querySelector(`[data-coach="${step.target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    if (step?.target) {
      const el = document.querySelector(`[data-coach="${step.target}"]`);
      (el as HTMLElement | null)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const id = window.setInterval(measure, 300);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.clearInterval(id);
    };
  }, [open, i, step?.target]);

  const finish = useCallback(() => {
    setOpen(false);
    markSeen(area);
    if (prevFocus.current instanceof HTMLElement) prevFocus.current.focus();
  }, [area, markSeen]);

  const next = useCallback(() => {
    // Don't call finish() inside a setI updater — updaters must be pure (no cross-component setState).
    if (i >= steps.length - 1) finish();
    else setI((n) => n + 1);
  }, [i, steps.length, finish]);
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  // Focus the card + keyboard controls (Esc skip, →/Enter next, ← back).
  useEffect(() => {
    if (!open) return;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); finish(); }
      else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, i, finish, next, back]);

  if (!mounted || !open || !step) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isMobile = vw < 640;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const spotlight = rect && step.target;

  let card: CSSProperties;
  if (isMobile) {
    card = { position: "fixed", left: 12, right: 12, bottom: 16, zIndex: 61 };
  } else if (!spotlight || step.placement === "center") {
    card = { position: "fixed", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 360, zIndex: 61 };
  } else {
    const W = 360, gap = 14, estH = 180;
    const p = step.placement ?? "bottom";
    let top: number, left: number;
    if (p === "right") { left = rect!.right + gap; top = rect!.top; }
    else if (p === "left") { left = rect!.left - W - gap; top = rect!.top; }
    else if (p === "top") { left = rect!.left; top = rect!.top - estH - gap; }
    else { left = rect!.left; top = rect!.bottom + gap; }
    left = Math.min(Math.max(12, left), vw - W - 12);
    top = Math.min(Math.max(12, top), vh - estH - 12);
    card = { position: "fixed", left, top, width: W, zIndex: 61 };
  }

  return createPortal(
    <>
      {spotlight ? (
        <div
          aria-hidden
          style={{
            position: "fixed",
            top: rect!.top - PAD,
            left: rect!.left - PAD,
            width: rect!.width + PAD * 2,
            height: rect!.height + PAD * 2,
            borderRadius: 12,
            boxShadow: "0 0 0 9999px rgba(20,18,43,0.45)",
            border: "2px solid #e8a33d",
            pointerEvents: "none",
            zIndex: 60,
            transition: reduce ? undefined : "top .2s ease, left .2s ease, width .2s ease, height .2s ease",
          }}
        />
      ) : (
        <div aria-hidden style={{ position: "fixed", inset: 0, background: "rgba(20,18,43,0.45)", pointerEvents: "none", zIndex: 60 }} />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        style={card}
        className="rounded-card border border-line bg-white p-5 shadow-[0_18px_50px_rgba(20,18,43,0.28)] outline-none"
      >
        <div aria-live="polite">
          <div className="text-xs font-medium uppercase tracking-wide text-marigold">Step {i + 1} of {steps.length}</div>
          <h3 id={titleId} className="mt-1 font-display text-lg text-ink">{step.title}</h3>
          <p id={bodyId} className="mt-1.5 text-sm text-muted">{step.body}</p>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={finish} className="text-xs text-muted transition hover:text-terra">Skip tour</button>
          <div className="flex gap-2">
            {i > 0 && (
              <button type="button" onClick={back} className="rounded-control border border-line px-3 py-1.5 text-sm text-ink transition hover:border-marigold">Back</button>
            )}
            <button type="button" onClick={next} className="rounded-control bg-marigold px-4 py-1.5 text-sm font-medium text-night transition hover:-translate-y-0.5">
              {i >= steps.length - 1 ? "Got it" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

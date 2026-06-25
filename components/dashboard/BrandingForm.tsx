"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { meetsContrast, readableTextOn, type BrandingFormState } from "@/lib/branding";
import { saveBrandingAction } from "@/app/dashboard/settings/branding/actions";

export interface ColorOption {
  key: string;
  label: string;
  hex: string;
}
export interface FontOption {
  key: string;
  label: string;
  fontFamily: string;
}
const LOCALE_OPTIONS = [
  { key: "en", label: "English" },
  { key: "hi", label: "हिंदी" },
  { key: "hinglish", label: "Hinglish" },
] as const;
const BACKGROUND_OPTIONS = [
  { key: "none", label: "None" },
  { key: "stars", label: "Stars" },
  { key: "zodiac", label: "Zodiac ring" },
  { key: "stars_zodiac", label: "Stars + Zodiac" },
] as const;

export interface BrandingFormDefaults {
  displayName: string;
  logoUrl: string | null;
  themeColor: string;
  fontKey: string;
  defaultLocale: string;
  backgroundStyle: string;
}

function Monogram({ name, color }: { name: string; color: string }) {
  const initial = (name.trim()[0] ?? "A").toUpperCase();
  return (
    <span
      className="grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-xl"
      style={{ backgroundColor: color, color: readableTextOn(color) }}
    >
      {initial}
    </span>
  );
}

export function BrandingForm({
  defaults,
  colors,
  fonts,
}: {
  defaults: BrandingFormDefaults;
  colors: ColorOption[];
  fonts: FontOption[];
}) {
  const [state, action, pending] = useActionState<BrandingFormState, FormData>(saveBrandingAction, {});

  const firstSafe = colors.find((c) => meetsContrast(c.hex))?.hex;
  const [themeColor, setThemeColor] = useState(
    defaults.themeColor || firstSafe || "#14122b",
  );
  const [fontKey, setFontKey] = useState(defaults.fontKey || fonts[0]?.key || "");
  const [locale, setLocale] = useState(defaults.defaultLocale || "en");
  const [bgStyle, setBgStyle] = useState(defaults.backgroundStyle || "stars_zodiac");
  const [logoPreview, setLogoPreview] = useState<string | null>(defaults.logoUrl);

  const fontFamily = fonts.find((f) => f.key === fontKey)?.fontFamily ?? "Inter";
  const textColor = readableTextOn(themeColor);
  const name = defaults.displayName || "Your name";

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setLogoPreview(URL.createObjectURL(file));
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="themeColor" value={themeColor} />
      <input type="hidden" name="fontKey" value={fontKey} />
      <input type="hidden" name="defaultLocale" value={locale} />
      <input type="hidden" name="backgroundStyle" value={bgStyle} />

      {/* Live preview */}
      <Card>
        <h2 className="mb-1 font-display text-lg text-ink">Preview</h2>
        <p className="mb-4 text-sm text-muted">How your public booking page header will look.</p>
        <div className="overflow-hidden rounded-card border border-line">
          <div className="flex items-center gap-4 px-6 py-7" style={{ backgroundColor: themeColor, color: textColor }}>
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreview}
                alt="Logo"
                className="h-12 w-12 shrink-0 rounded-full bg-white object-cover"
                onError={() => setLogoPreview(null)}
              />
            ) : (
              <Monogram name={name} color={textColor === "#14122b" ? "#ffffff" : "#14122b"} />
            )}
            <div className="min-w-0">
              <div className="truncate text-2xl" style={{ fontFamily }}>
                {name}
              </div>
              <div className="text-sm opacity-80" style={{ fontFamily }}>
                Book a consultation
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Logo */}
      <Card>
        <h2 className="mb-1 font-display text-lg text-ink">Logo</h2>
        <p className="mb-3 text-sm text-muted">PNG, JPG or SVG up to 2 MB. Square works best.</p>
        <input
          type="file"
          name="logo"
          accept="image/*"
          onChange={onLogoChange}
          className="block w-full text-sm text-muted file:mr-3 file:rounded-control file:border file:border-line file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:border-marigold"
        />
      </Card>

      {/* Theme colour */}
      <Card>
        <h2 className="mb-1 font-display text-lg text-ink">Theme colour</h2>
        <p className="mb-3 text-sm text-muted">
          Choose from the curated palette. Colours without enough contrast for readable text are
          shown dimmed and can&apos;t be selected.
        </p>
        {colors.length === 0 ? (
          <p className="text-sm text-muted">No theme colours configured yet — ask the operator.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {colors.map((c) => {
              const selected = c.hex.toLowerCase() === themeColor.toLowerCase();
              const safe = meetsContrast(c.hex);
              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={!safe}
                  onClick={() => setThemeColor(c.hex)}
                  title={safe ? c.label : `${c.label} — low contrast`}
                  className={`h-10 w-10 rounded-full border transition ${
                    selected ? "ring-2 ring-marigold ring-offset-2" : "border-line"
                  } ${safe ? "hover:scale-105" : "cursor-not-allowed opacity-30"}`}
                  style={{ backgroundColor: c.hex }}
                  aria-label={c.label}
                  aria-pressed={selected}
                />
              );
            })}
          </div>
        )}
      </Card>

      {/* Display font */}
      <Card>
        <h2 className="mb-1 font-display text-lg text-ink">Display font</h2>
        <p className="mb-3 text-sm text-muted">Used for your name and headings on the booking page.</p>
        {fonts.length === 0 ? (
          <p className="text-sm text-muted">No fonts configured yet — ask the operator.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {fonts.map((f) => {
              const selected = f.key === fontKey;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFontKey(f.key)}
                  className={`rounded-control border px-4 py-2 text-sm transition ${
                    selected ? "border-marigold bg-marigold/10 text-ink" : "border-line text-muted hover:border-marigold"
                  }`}
                  style={{ fontFamily: f.fontFamily }}
                  aria-pressed={selected}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Background style */}
      <Card>
        <h2 className="mb-1 font-display text-lg text-ink">Hero background</h2>
        <p className="mb-3 text-sm text-muted">Celestial motion behind your profile hero. Subtle and respects reduced-motion settings.</p>
        <div className="flex flex-wrap gap-2">
          {BACKGROUND_OPTIONS.map((b) => {
            const selected = b.key === bgStyle;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setBgStyle(b.key)}
                className={`rounded-control border px-4 py-2 text-sm transition ${
                  selected ? "border-marigold bg-marigold/10 text-ink" : "border-line text-muted hover:border-marigold"
                }`}
                aria-pressed={selected}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Default language */}
      <Card>
        <h2 className="mb-1 font-display text-lg text-ink">Default language</h2>
        <p className="mb-3 text-sm text-muted">The language your booking page opens in.</p>
        <div className="inline-flex rounded-control border border-line p-1">
          {LOCALE_OPTIONS.map((l) => {
            const selected = l.key === locale;
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => setLocale(l.key)}
                className={`rounded-[7px] px-4 py-1.5 text-sm transition ${
                  selected ? "bg-marigold text-night" : "text-muted hover:text-ink"
                }`}
                aria-pressed={selected}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </Card>

      {state.error && <p className="text-sm text-terra">{state.error}</p>}
      {state.ok && <p className="text-sm text-green">Branding saved.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save branding"}
      </Button>
    </form>
  );
}

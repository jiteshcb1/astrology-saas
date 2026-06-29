import { getPromo, promoActive, istToday } from "@/lib/promo";

// SP — site-wide promo line at the very top of the marketing pages, shown only while the campaign is active.
export async function PromoBanner() {
  const promo = await getPromo();
  if (!promoActive(promo, istToday())) return null;
  return (
    <div className="bg-marigold text-night">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-6 py-2 text-center text-sm">
        <span aria-hidden>✦</span>
        <span>
          <strong className="font-semibold">{promo.name}</strong> — {promo.tagline}
        </span>
      </div>
    </div>
  );
}

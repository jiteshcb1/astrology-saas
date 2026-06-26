import { getBookingsByPackage } from "@/lib/consultant-home";
import { getBranding, resolveBrand } from "@/lib/branding";
import { chartAriaLabel } from "@/lib/month-series";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { HorizontalBarChartView } from "@/components/ui/charts";

// SP-5.6 — confirmed bookings by package over the last 90 days (primary→secondary gradient). Bars link to that
// package's bookings.
export async function BookingsByPackageChart({ orgId, now = new Date() }: { orgId: string; now?: Date }) {
  const [data, branding] = await Promise.all([getBookingsByPackage(orgId, 90, now), getBranding(orgId)]);
  const { primary, secondary } = resolveBrand(branding?.themeColor);
  return (
    <Card>
      <h2 className="mb-4 font-display text-lg text-ink">Bookings by package</h2>
      <p className="-mt-3 mb-3 text-xs text-muted">Last 90 days</p>
      {data.length === 0 ? (
        <EmptyState variant="no_bookings_yet" />
      ) : (
        <div role="img" aria-label={chartAriaLabel("Bookings by package", data, "count")}>
          <HorizontalBarChartView data={data} primary={primary} secondary={secondary} hrefBase="/dashboard/bookings?package=" />
        </div>
      )}
    </Card>
  );
}

import type { Metadata } from "next";
import { getHeldBooking, type SeekerDetails } from "@/lib/booking";
import { BookingFlow } from "@/components/public/BookingFlow";
import { PublicOffline } from "@/components/public/PublicOffline";
import { confirmBookingAction, reholdAction } from "../actions";

export const metadata: Metadata = { title: "Complete your booking", robots: { index: false } };

export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string; bookingId: string }>;
}) {
  const { slug, bookingId } = await params;
  const data = await getHeldBooking(slug, bookingId);
  if (!data) return <PublicOffline />;

  async function confirm(details: SeekerDetails, answers: Record<string, string>) {
    "use server";
    return confirmBookingAction(slug, bookingId, details, answers);
  }
  async function rehold() {
    "use server";
    return reholdAction(slug, data!.package.id, data!.durationMin, data!.startISO);
  }

  return <BookingFlow data={data} confirm={confirm} rehold={rehold} />;
}

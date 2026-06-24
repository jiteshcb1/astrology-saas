import type { Metadata } from "next";
import { getHeldBooking, type SeekerDetails } from "@/lib/booking";
import { getPaymentContext } from "@/lib/payment";
import { BookingFlow } from "@/components/public/BookingFlow";
import { PublicOffline } from "@/components/public/PublicOffline";
import {
  confirmBookingAction,
  reholdAction,
  createGatewayOrderAction,
  confirmGatewayPaymentAction,
  submitUpiProofAction,
} from "../actions";

export const metadata: Metadata = { title: "Complete your booking", robots: { index: false } };

export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string; bookingId: string }>;
}) {
  const { slug, bookingId } = await params;
  const [data, paymentContext] = await Promise.all([getHeldBooking(slug, bookingId), getPaymentContext(slug, bookingId)]);
  if (!data) return <PublicOffline />;

  async function confirm(details: SeekerDetails, answers: Record<string, string>) {
    "use server";
    return confirmBookingAction(slug, bookingId, details, answers);
  }
  async function rehold() {
    "use server";
    return reholdAction(slug, data!.package.id, data!.durationMin, data!.startISO);
  }
  async function createGatewayOrder() {
    "use server";
    return createGatewayOrderAction(slug, bookingId);
  }
  async function confirmGatewayPayment(proof: { orderId: string; paymentId: string; signature: string }) {
    "use server";
    return confirmGatewayPaymentAction(slug, bookingId, proof);
  }
  async function submitUpiProof(formData: FormData) {
    "use server";
    return submitUpiProofAction(slug, bookingId, formData);
  }

  return (
    <BookingFlow
      data={data}
      confirm={confirm}
      rehold={rehold}
      paymentContext={paymentContext}
      createGatewayOrder={createGatewayOrder}
      confirmGatewayPayment={confirmGatewayPayment}
      submitUpiProof={submitUpiProof}
    />
  );
}

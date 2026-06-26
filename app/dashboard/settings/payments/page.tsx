import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { getProfile } from "@/lib/consultant-profile";
import { getPaymentMethod, toSafeView } from "@/lib/payments";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { PaymentForm } from "@/components/dashboard/PaymentForm";

export default async function PaymentsSettingsPage() {
  const { role, orgId } = await requireSection("settings");
  const profile = orgId ? await getProfile(orgId) : null;
  if (role === "consultant" && (!orgId || !profile?.onboardedAt)) redirect("/onboarding");

  // Safe view only — no encrypted secrets ever reach the client.
  const current = orgId ? await toSafeView(await getPaymentMethod(orgId)) : null;

  return (
    <>
      <PageHeader title="Payments" subtitle="How you collect payment — directly to you" />
      <div className="mx-auto w-full max-w-2xl px-6 py-6">
        <Link href="/dashboard/settings" className="text-sm text-muted hover:text-terra">
          ← Settings
        </Link>
        <div className="mt-4">
          <PaymentForm current={current} />
        </div>
      </div>
    </>
  );
}

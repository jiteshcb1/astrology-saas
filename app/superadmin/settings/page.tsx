import { requireRole } from "@/lib/rbac";
import { getEmailSettings } from "@/lib/platform-settings";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { EmailToggleCard } from "@/components/superadmin/EmailToggleCard";

export default async function SuperadminSettingsPage() {
  await requireRole("access:superadmin");
  const emails = await getEmailSettings();

  return (
    <>
      <PageHeader title="Settings" subtitle="Platform operational toggles" />
      <div className="mx-auto w-full max-w-2xl px-6 py-6">
        <h2 className="mb-1 font-display text-lg text-ink">Email sending</h2>
        <p className="mb-4 text-sm text-muted">Pause outbound email to conserve your Resend quota. Each category is independent.</p>
        <div className="space-y-4">
          <EmailToggleCard
            category="transactional"
            title="Notification & transactional emails"
            description="Booking confirmations, payment-proof receipts, new-booking alerts, consultant welcome, receipts."
            warning="Paused — seekers and consultants won't receive booking/payment emails until you re-enable this."
            initialEnabled={emails.transactional.enabled}
            updatedAtISO={emails.transactional.updatedAtISO}
          />
          <EmailToggleCard
            category="otp"
            title="OTP sign-in emails"
            description="One-time codes for email-based sign-in."
            warning="Paused — email-only sign-in is blocked while this is off. Google sign-in still works."
            initialEnabled={emails.otp.enabled}
            updatedAtISO={emails.otp.updatedAtISO}
          />
        </div>
      </div>
    </>
  );
}

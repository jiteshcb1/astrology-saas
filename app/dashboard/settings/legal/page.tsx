import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getProfile } from "@/lib/consultant-profile";
import { getLegalDocuments } from "@/lib/legal";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { LegalForm } from "@/components/dashboard/LegalForm";

export default async function LegalSettingsPage() {
  const { session, role } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  const profile = orgId ? await getProfile(orgId) : null;
  if (role === "consultant" && (!orgId || !profile?.onboardedAt)) redirect("/onboarding");

  const doc = orgId ? await getLegalDocuments(orgId) : null;
  const defaults = {
    privacyPolicy: doc?.privacyPolicy ?? "",
    termsConditions: doc?.termsConditions ?? "",
    updatedAtISO: doc ? doc.updatedAt.toISOString() : null,
  };

  return (
    <>
      <PageHeader title="Legal" subtitle="Privacy policy & terms shown on your public booking page" />
      <div className="mx-auto w-full max-w-2xl px-6 py-6">
        <Link href="/dashboard/settings" className="text-sm text-muted hover:text-terra">
          ← Settings
        </Link>
        <div className="mt-4">
          <LegalForm defaults={defaults} />
        </div>
      </div>
    </>
  );
}

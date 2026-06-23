import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getProfile } from "@/lib/consultant-profile";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { ProfileForm } from "@/components/dashboard/ProfileForm";

export default async function ProfileSettingsPage() {
  const { session, role } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  const profile = orgId ? await getProfile(orgId) : null;
  if (role === "consultant" && (!orgId || !profile?.onboardedAt)) redirect("/onboarding");

  const social = (profile?.socialLinks ?? {}) as Record<string, string>;
  const defaults = {
    displayName: profile?.displayName ?? "",
    bio: profile?.bio ?? "",
    experience: profile?.experience ?? "",
    specialities: profile?.specialities ?? [],
    website: social.website ?? "",
    instagram: social.instagram ?? "",
    youtube: social.youtube ?? "",
    x: social.x ?? "",
    gstNumber: profile?.gstNumber ?? "",
    gstLegalName: profile?.gstLegalName ?? "",
    complaintsContactNumber: profile?.complaintsContactNumber ?? "",
  };

  return (
    <>
      <PageHeader title="Profile" subtitle="What seekers see on your public booking page" />
      <div className="mx-auto w-full max-w-2xl px-6 py-6">
        <Link href="/dashboard/settings" className="text-sm text-muted hover:text-terra">
          ← Settings
        </Link>
        <div className="mt-4">
          <ProfileForm defaults={defaults} />
        </div>
      </div>
    </>
  );
}

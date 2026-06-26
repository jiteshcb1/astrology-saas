import { requireSection } from "@/lib/rbac";
import { getMyAccount } from "@/lib/account";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { AccountForm } from "@/components/dashboard/AccountForm";

export default async function AccountPage() {
  const { session, role } = await requireSection("account");
  const user = await getMyAccount(session.user.id);
  return (
    <>
      <PageHeader title={role === "team_consulting" ? "My Profile" : "Account"} subtitle="Your name and contact details" />
      <div className="mx-auto w-full max-w-xl px-6 py-6">
        <AccountForm defaults={{ name: user?.name ?? "", phone: user?.phone ?? "", email: user?.email ?? "" }} />
      </div>
    </>
  );
}

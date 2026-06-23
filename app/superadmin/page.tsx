import Link from "next/link";
import { auth } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { SignOutForm } from "@/components/SignOutForm";

export default async function SuperadminHome() {
  const session = await auth();
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Super Admin</h1>
        <SignOutForm />
      </div>
      <Card>
        <p>
          Signed in as <strong>{session?.user?.email}</strong> ({session?.user?.role}).
        </p>
        <p className="mt-2 text-sm text-muted">
          <Link className="text-terra hover:underline" href="/superadmin/consultants">
            Consultants
          </Link>{" "}
          and{" "}
          <Link className="text-terra hover:underline" href="/superadmin/plans">
            Plans
          </Link>{" "}
          and{" "}
          <Link className="text-terra hover:underline" href="/superadmin/flags">
            Feature flags
          </Link>
          ,{" "}
          <Link className="text-terra hover:underline" href="/superadmin/oversight">
            Oversight
          </Link>{" "}
          and{" "}
          <Link className="text-terra hover:underline" href="/superadmin/catalogs">
            Catalogs
          </Link>{" "}
          are live. SP-1 is complete.
        </p>
      </Card>
    </main>
  );
}

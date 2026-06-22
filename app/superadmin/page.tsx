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
          is live. Plans, feature flags & oversight arrive in SP-1.4–1.7.
        </p>
      </Card>
    </main>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { FlagForm } from "../FlagForm";

export default async function NewFlagPage() {
  const [plans, orgs] = await Promise.all([
    prisma.subscriptionPlan.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <div className="mb-6">
        <Link href="/superadmin/flags" className="text-sm text-muted hover:text-terra">
          ← Feature flags
        </Link>
        <h1 className="mt-2 font-display text-2xl text-ink">New flag</h1>
        <p className="text-sm text-muted">
          Precedence when resolved: org &gt; plan &gt; global &gt; off.
        </p>
      </div>
      <Card>
        <FlagForm plans={plans} orgs={orgs} />
      </Card>
    </main>
  );
}

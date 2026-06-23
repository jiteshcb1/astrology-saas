import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { FlagForm } from "../FlagForm";
import { updateFlagAction } from "../actions";

export default async function FlagEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [flag, plans, orgs] = await Promise.all([
    prisma.featureFlag.findUnique({ where: { id } }),
    prisma.subscriptionPlan.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!flag) notFound();

  return (
    <>
      <PageHeader title={`Edit flag · ${flag.key}`} />
      <div className="mx-auto w-full max-w-xl px-6 py-8 md:px-8">
        <Link href="/superadmin/flags" className="text-sm text-muted hover:text-terra">
          ← Feature flags
        </Link>
        <Card className="mt-4">
          <FlagForm
            plans={plans}
            orgs={orgs}
            action={updateFlagAction}
            flagId={flag.id}
            defaults={{ key: flag.key, scope: flag.scope, scopeId: flag.scopeId, enabled: flag.enabled }}
            submitLabel="Save changes"
          />
        </Card>
      </div>
    </>
  );
}

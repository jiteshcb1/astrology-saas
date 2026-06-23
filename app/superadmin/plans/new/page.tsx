import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { PlanForm } from "../PlanForm";
import { createPlanAction } from "../actions";

export default function NewPlanPage() {
  return (
    <>
      <PageHeader title="New plan" />
      <div className="mx-auto w-full max-w-xl px-6 py-8 md:px-8">
        <Link href="/superadmin/plans" className="text-sm text-muted hover:text-terra">
          ← Plans
        </Link>
        <Card className="mt-4">
          <PlanForm action={createPlanAction} submitLabel="Create plan" />
        </Card>
      </div>
    </>
  );
}

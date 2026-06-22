import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PlanForm } from "../PlanForm";
import { createPlanAction } from "../actions";

export default function NewPlanPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <div className="mb-6">
        <Link href="/superadmin/plans" className="text-sm text-muted hover:text-terra">
          ← Plans
        </Link>
        <h1 className="mt-2 font-display text-2xl text-ink">New plan</h1>
      </div>
      <Card>
        <PlanForm action={createPlanAction} submitLabel="Create plan" />
      </Card>
    </main>
  );
}

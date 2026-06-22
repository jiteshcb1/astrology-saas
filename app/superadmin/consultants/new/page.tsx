import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ConsultantCreateForm } from "../ConsultantCreateForm";

export default function NewConsultantPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <div className="mb-6">
        <Link href="/superadmin/consultants" className="text-sm text-muted hover:text-terra">
          ← Consultants
        </Link>
        <h1 className="mt-2 font-display text-2xl text-ink">New consultant</h1>
      </div>
      <Card>
        <ConsultantCreateForm />
      </Card>
    </main>
  );
}

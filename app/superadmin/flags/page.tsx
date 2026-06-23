import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { deleteFlagAction, toggleFlagAction } from "./actions";

export default async function FlagsPage() {
  const flags = await prisma.featureFlag.findMany({ orderBy: [{ key: "asc" }, { scope: "asc" }] });

  const planIds = flags.filter((f) => f.scope === "plan" && f.scopeId).map((f) => f.scopeId!);
  const orgIds = flags.filter((f) => f.scope === "org" && f.scopeId).map((f) => f.scopeId!);
  const [plans, orgs] = await Promise.all([
    prisma.subscriptionPlan.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true } }),
    prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } }),
  ]);
  const planName = new Map(plans.map((p) => [p.id, p.name]));
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

  const target = (scope: string, scopeId: string | null) => {
    if (scope === "global") return "—";
    if (!scopeId) return "—";
    return (scope === "plan" ? planName.get(scopeId) : orgName.get(scopeId)) ?? scopeId;
  };

  return (
    <>
      <PageHeader title="Feature flags">
        <Link href="/superadmin/flags/new">
          <Button>New flag</Button>
        </Link>
      </PageHeader>
      <div className="mx-auto w-full max-w-5xl px-6 py-8 md:px-8">
        <p className="mb-4 text-sm text-muted">Resolution precedence: org &gt; plan &gt; global &gt; off.</p>
        {flags.length === 0 ? (
          <div className="rounded-card border border-line bg-white">
            <EmptyState title="No flags yet" message="Add a flag to toggle a feature globally, per plan, or per org." />
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Key</th>
                  <th className="px-4 py-3 font-medium">Scope</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => (
                  <tr key={flag.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{flag.key}</td>
                    <td className="px-4 py-3 text-muted">{flag.scope}</td>
                    <td className="px-4 py-3 text-muted">{target(flag.scope, flag.scopeId)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          flag.enabled ? "bg-green/15 text-green" : "bg-terra/15 text-terra"
                        }`}
                      >
                        {flag.enabled ? "enabled" : "disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <form action={toggleFlagAction}>
                          <input type="hidden" name="id" value={flag.id} />
                          <input type="hidden" name="enabled" value={flag.enabled ? "false" : "true"} />
                          <Button type="submit" variant="ghost">
                            {flag.enabled ? "Disable" : "Enable"}
                          </Button>
                        </form>
                        <Link
                          href={`/superadmin/flags/${flag.id}`}
                          className="rounded-control border border-line px-3 py-2 text-sm text-ink transition hover:border-marigold"
                        >
                          Edit
                        </Link>
                        <ConfirmDeleteButton action={deleteFlagAction}>
                          <input type="hidden" name="id" value={flag.id} />
                        </ConfirmDeleteButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

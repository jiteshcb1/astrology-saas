import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, roleHome } from "@/lib/rbac";

// Both providers funnel here after sign-in (and after accepting a team invite). Route by the LIVE DB role
// so a just-accepted member lands on the dashboard even though their cached JWT claim is still stale.
export default async function PostAuthPage() {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  redirect(roleHome(user?.role ?? session.user.role));
}

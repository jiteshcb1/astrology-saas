import { redirect } from "next/navigation";
import { requireAuth, roleHome } from "@/lib/rbac";

// Both providers funnel here after sign-in; route to the role's home.
export default async function PostAuthPage() {
  const session = await requireAuth();
  redirect(roleHome(session.user.role));
}

"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/rbac";
import { signOut } from "@/lib/auth";
import { acceptInviteCore } from "@/lib/team";

export async function acceptInviteAction(token: string): Promise<{ error: string } | void> {
  const session = await requireAuth(); // → /signin if not authenticated
  const result = await acceptInviteCore(token, session.user.id);
  if (!result.ok) return { error: result.error };
  redirect("/post-auth"); // routes by live role → the member's dashboard
}

export async function signOutAndReturnAction(callbackUrl: string): Promise<void> {
  await signOut({ redirectTo: callbackUrl });
}

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";

// SP-7.1 coaching state (per-user, platform-level — no tenant-isolation concern). Stored as a JSON map on
// User.coachingSeen, e.g. { "dashboard": true }.
function asMap(v: unknown): Record<string, boolean> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, boolean>) : {};
}

export async function markCoachingSeenAction(area: string): Promise<void> {
  const { session } = await requireRole("access:dashboard");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { coachingSeen: true } });
  const seen = asMap(user?.coachingSeen);
  if (seen[area]) return;
  await prisma.user.update({ where: { id: session.user.id }, data: { coachingSeen: { ...seen, [area]: true } } });
}

// "Replay product tour" — clears all flags so every area's coach marks show again.
export async function replayToursAction(): Promise<void> {
  const { session } = await requireRole("access:dashboard");
  await prisma.user.update({ where: { id: session.user.id }, data: { coachingSeen: {} } });
  // The dashboard layout reads coachingSeen → re-render it so tours show again immediately.
  revalidatePath("/dashboard", "layout");
}

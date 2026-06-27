import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { findActiveMembershipByUser } from "@/lib/tenant-db";
import { canSee } from "@/lib/dashboard-policy";
import { env, isDev } from "@/lib/env";
import { buildAuthUrl, isGoogleOAuthConfigured } from "@/lib/google-oauth";

// Track I T-1.1 — begin the SEPARATE Calendar OAuth flow. Sets a short-lived CSRF `state` cookie, then
// redirects to Google's consent screen. Node runtime (Prisma/auth need full Node; no edge).
const BASE = env.AUTH_URL.replace(/\/$/, "");

export async function GET(req: NextRequest): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(`${BASE}/signin`);
  if (!isGoogleOAuthConfigured()) return NextResponse.redirect(`${BASE}/dashboard/settings/calendar?error=not_configured`);

  const member = await findActiveMembershipByUser(session.user.id);
  if (!member || !canSee(member.role, "calendar")) return new NextResponse("Forbidden", { status: 403 });

  const state = randomBytes(32).toString("hex");
  const ret = req.nextUrl.searchParams.get("return") === "onboarding" ? "onboarding" : "settings";
  const res = NextResponse.redirect(buildAuthUrl(state));
  // sameSite=lax so the cookie survives Google's top-level redirect back to /callback.
  const opts = { httpOnly: true, secure: !isDev, sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set("gcal_state", state, opts);
  res.cookies.set("gcal_return", ret, opts);
  return res;
}

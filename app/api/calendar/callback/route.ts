import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { findActiveMembershipByUser } from "@/lib/tenant-db";
import { canSee } from "@/lib/dashboard-policy";
import { env } from "@/lib/env";
import { exchangeCode, getPrimaryCalendar } from "@/lib/google-oauth";
import { saveCalendarConnectionCore, statesMatch } from "@/lib/calendar";

// Track I T-1.1 — Google's redirect after consent. Verifies the CSRF state, exchanges the code for tokens,
// stores them ENVELOPE-ENCRYPTED, and redirects back. No token value is ever returned to the client.
const BASE = env.AUTH_URL.replace(/\/$/, "");

function back(ret: string, query: string): NextResponse {
  const dest = ret === "onboarding" ? `/onboarding?${query}` : `/dashboard/settings/calendar?${query}`;
  const res = NextResponse.redirect(`${BASE}${dest}`);
  res.cookies.set("gcal_state", "", { path: "/", maxAge: 0 });
  res.cookies.set("gcal_return", "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(`${BASE}/signin`);

  const member = await findActiveMembershipByUser(session.user.id);
  if (!member || !canSee(member.role, "calendar")) return new NextResponse("Forbidden", { status: 403 });

  const ret = req.cookies.get("gcal_return")?.value === "onboarding" ? "onboarding" : "settings";
  const sp = req.nextUrl.searchParams;

  if (sp.get("error")) return back(ret, "error=denied"); // user declined consent
  if (!statesMatch(req.cookies.get("gcal_state")?.value, sp.get("state"))) return back(ret, "error=state");

  const code = sp.get("code");
  if (!code) return back(ret, "error=denied");

  const exchanged = await exchangeCode(code);
  if (!exchanged.ok) return back(ret, "error=exchange");

  const { accessToken, refreshToken, expiresInSec } = exchanged.tokens;
  const primary = await getPrimaryCalendar(accessToken); // primary calendar id == account email
  const saved = await saveCalendarConnectionCore(
    member.organizationId,
    member.id,
    {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + expiresInSec * 1000),
      calendarId: "primary",
      googleEmail: primary?.id ?? null,
    },
    session.user.id,
  );
  if (!saved.ok) return back(ret, "error=save");

  return back(ret, "connected=true");
}

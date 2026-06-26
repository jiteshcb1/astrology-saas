import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { resolveBrand } from "@/lib/branding";
import { getInviteByToken, roleLabel } from "@/lib/team";
import { AcceptInviteButton } from "@/components/public/AcceptInviteButton";
import { signOutAndReturnAction } from "./actions";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const view = await getInviteByToken(token);
  return { title: view ? `Join ${view.orgName} on Astro Consultancy` : "Team invitation" };
}

function Shell({ accent, onAccent, brandName, logoUrl, children }: { accent: string; onAccent: string; brandName: string; logoUrl: string | null; children: React.ReactNode }) {
  const initial = (brandName.trim()[0] ?? "A").toUpperCase();
  return (
    <div className="min-h-screen bg-sand">
      <header className="px-6 py-8" style={{ backgroundColor: accent, color: onAccent }}>
        <div className="mx-auto flex max-w-lg items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brandName} className="h-11 w-11 rounded-full bg-white object-cover" />
          ) : (
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white font-display" style={{ color: accent }}>{initial}</span>
          )}
          <span className="font-display text-lg">{brandName}</span>
        </div>
      </header>
      <div className="mx-auto max-w-lg px-6 py-8">{children}</div>
    </div>
  );
}

const ROLE_DESC: Record<string, string> = {
  team_consulting: "Runs sessions, manages their own availability, and takes assigned bookings.",
  team_accounts: "Views receipts and financial records only — no access to bookings or seeker data.",
};

export default async function AcceptInvitePage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const view = await getInviteByToken(token);
  const session = await auth();
  const accent = view?.themeColor || "#14122b";
  const { onPrimary } = resolveBrand(view?.themeColor ?? null);
  const onAccent = onPrimary;

  if (!view) {
    return (
      <Shell accent="#14122b" onAccent="#f6efe2" brandName="Astro Consultancy" logoUrl={null}>
        <h1 className="font-display text-2xl text-ink">Invitation not found</h1>
        <p className="mt-2 text-sm text-muted">This invite link is invalid. Please ask whoever invited you to send a fresh one.</p>
      </Shell>
    );
  }

  const inviter = view.inviterName || view.orgName;

  return (
    <Shell accent={accent} onAccent={onAccent} brandName={view.orgName} logoUrl={view.logoUrl}>
      {view.state === "expired" ? (
        <>
          <h1 className="font-display text-2xl text-ink">This invitation has expired</h1>
          <p className="mt-2 text-sm text-muted">Invitations are valid for 7 days. Ask {inviter} to send you a new invite.</p>
        </>
      ) : view.state === "accepted" ? (
        <>
          <h1 className="font-display text-2xl text-ink">Already accepted</h1>
          <p className="mt-2 text-sm text-muted">This invitation has already been accepted.</p>
          <Link href="/signin" className="mt-4 inline-block text-sm font-medium text-terra hover:underline">Sign in to your dashboard →</Link>
        </>
      ) : view.state === "invalid" ? (
        <>
          <h1 className="font-display text-2xl text-ink">Invitation unavailable</h1>
          <p className="mt-2 text-sm text-muted">This invitation is no longer active. Ask {inviter} to send a new one.</p>
        </>
      ) : (
        <>
          <h1 className="font-display text-2xl text-ink">You&apos;ve been invited to join {view.orgName}&apos;s team</h1>
          <p className="mt-1 text-sm text-muted">{inviter} invited you to collaborate on Astro Consultancy.</p>

          <div className="mt-5 rounded-card border border-line bg-white p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-night/10 text-night">
                {view.role === "team_accounts" ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h9l3 3v15l-3-2-3 2-3-2-3 2V3z" strokeLinejoin="round" /><path d="M9 8h6M9 12h6" strokeLinecap="round" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" strokeLinecap="round" /></svg>
                )}
              </span>
              <div>
                <p className="font-display text-lg text-ink">{roleLabel(view.role)}</p>
                <p className="text-sm text-muted">{ROLE_DESC[view.role] ?? ""}</p>
              </div>
            </div>
          </div>

          {view.message && <p className="mt-4 rounded-control bg-sand-2/50 px-4 py-3 text-sm italic text-ink">“{view.message}”</p>}

          <div className="mt-6">
            {!session?.user?.id ? (
              <Link
                href={`/signin?callbackUrl=${encodeURIComponent(`/${slug}/invite/${token}`)}`}
                style={{ backgroundColor: accent, color: onAccent }}
                className="block w-full rounded-control px-6 py-3 text-center text-sm font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.15)] transition hover:opacity-95"
              >
                Sign in to accept
              </Link>
            ) : (
              <>
                {session.user.email && view.email && session.user.email.toLowerCase() !== view.email.toLowerCase() && (
                  <div className="mb-3 rounded-control border border-marigold/40 bg-marigold/10 px-4 py-3 text-sm text-ink">
                    You&apos;re signed in as <strong>{session.user.email}</strong>, but this invite was sent to <strong>{view.email}</strong>. You can accept with this account, or
                    <form action={signOutAndReturnAction.bind(null, `/${slug}/invite/${token}`)} className="mt-1 inline">
                      <button type="submit" className="font-medium text-terra hover:underline"> sign out</button>
                    </form>{" "}to use a different one.
                  </div>
                )}
                <AcceptInviteButton token={token} accent={accent} onAccent={onAccent} />
              </>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}

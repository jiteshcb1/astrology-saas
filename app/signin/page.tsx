import { CosmicPanel } from "@/components/auth/CosmicPanel";
import { SignInForm } from "./SignInForm";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; claim?: string }> }) {
  const { callbackUrl, claim } = await searchParams;
  // Only honor app-internal relative paths (avoid open-redirect).
  const safe = callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : undefined;
  // SP-7.1: carry the marketing "claim your jyoti.app/<name>" handle through login → /post-auth provisions
  // the org with it. Sanitized to slug chars here; re-validated in provisionSelfServeOrgCore.
  const slug = (claim ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
  const dest = safe ?? (slug ? `/post-auth?claim=${encodeURIComponent(slug)}` : undefined);
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      <CosmicPanel />
      <div className="flex flex-1 items-center justify-center bg-sand px-4 py-10 lg:px-8">
        <div className="w-full max-w-md rounded-card border border-line bg-white p-8 shadow-[0_10px_40px_rgba(20,18,43,0.08)]">
          <SignInForm callbackUrl={dest} />
        </div>
      </div>
    </main>
  );
}

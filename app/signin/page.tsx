import { CosmicPanel } from "@/components/auth/CosmicPanel";
import { SignInForm } from "./SignInForm";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  // Only honor app-internal relative paths (avoid open-redirect).
  const safe = callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : undefined;
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      <CosmicPanel />
      <div className="flex flex-1 items-center justify-center bg-sand px-4 py-10 lg:px-8">
        <div className="w-full max-w-md rounded-card border border-line bg-white p-8 shadow-[0_10px_40px_rgba(20,18,43,0.08)]">
          <SignInForm callbackUrl={safe} />
        </div>
      </div>
    </main>
  );
}

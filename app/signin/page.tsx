import { Card } from "@/components/ui/Card";
import { SignInForm } from "./SignInForm";

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-night px-4 py-16">
      <Card className="w-full max-w-md border-line-dark bg-night-2 text-sand">
        <div className="mb-6 text-center">
          <div className="font-logo text-2xl text-sand">Astro Consultancy</div>
          <h1 className="mt-2 font-display text-xl text-sand">Sign in</h1>
          <p className="mt-1 text-sm text-sand/60">Continue with Google or your email.</p>
        </div>
        <SignInForm />
      </Card>
    </main>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestOtp } from "./actions";

export function SignInForm({ callbackUrl = "/post-auth" }: { callbackUrl?: string }) {
  const router = useRouter();
  const dest = callbackUrl || "/post-auth";
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const res = await requestOtp(email);
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setMessage(res.message);
    setDevCode(res.devCode ?? null);
    setStep("code");
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("email-otp", { email, code, redirect: false });
    setLoading(false);
    if (!res || res.error) {
      setError("Invalid or expired code.");
      return;
    }
    router.push(dest);
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-2xl text-ink">{step === "email" ? "Sign in" : "Check your email"}</h2>
        <p className="mt-1 text-sm text-muted">
          {step === "email"
            ? "Continue with Google, or get a one-time code by email."
            : `Enter the 6-digit code sent to ${email}.`}
        </p>
      </div>

      {step === "email" ? (
        <div className="space-y-4">
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => signIn("google", { callbackUrl: dest })}
          >
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={onRequest} className="space-y-4">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending…" : "Send code"}
            </Button>
          </form>
        </div>
      ) : (
        <form onSubmit={onVerify} className="space-y-4">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            label="6-digit code"
            placeholder="123456"
            className="text-center text-lg tracking-[0.4em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            required
          />
          <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
            {loading ? "Verifying…" : "Verify & continue"}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted transition hover:text-terra"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
          >
            Use a different email
          </button>
        </form>
      )}

      {message && <p className="mt-4 text-sm text-green">{message}</p>}
      {devCode && (
        <p className="mt-2 rounded-control bg-sand-2/60 px-3 py-2 text-xs text-muted">
          Dev code: <span className="font-medium text-ink">{devCode}</span>
        </p>
      )}
      {error && <p className="mt-4 text-sm text-terra">{error}</p>}
    </div>
  );
}

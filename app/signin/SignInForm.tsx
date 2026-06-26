"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestOtp } from "./actions";

// Matches RESEND_COOLDOWN_MS in lib/otp.ts — the server rejects an earlier resend, so disable the button
// for the same window (kept in sync manually; lib/otp can't be imported into a client component).
const RESEND_COOLDOWN_SECONDS = 30;

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
  const [cooldown, setCooldown] = useState(0);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Issue a code (used by both the initial request and "Resend"). Each fresh code invalidates the prior one
  // server-side, so there is only ever one valid code to enter.
  async function sendCode() {
    setError(null);
    setMessage(null);
    const res = await requestOtp(email);
    if (!res.ok) {
      setError(res.message);
      // A cooldown tells us exactly how long to disable the resend button.
      if (res.retryAfter) setCooldown(res.retryAfter);
      return false;
    }
    setMessage(res.message);
    setDevCode(res.devCode ?? null);
    setCode("");
    setCooldown(RESEND_COOLDOWN_SECONDS);
    return true;
  }

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const ok = await sendCode();
    setLoading(false);
    if (ok) setStep("code");
  }

  async function onResend() {
    setLoading(true);
    await sendCode();
    setLoading(false);
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("email-otp", { email, code, redirect: false });
    setLoading(false);
    if (!res || res.error) {
      // Auth.js collapses every credential failure into one error, so we can't tell wrong-vs-expired-vs-locked
      // apart here — guide the user to the recovery path (request a fresh code) either way.
      setError("That code didn't work — it may be expired or already used. Request a new one below.");
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
            <Button type="submit" className="w-full" loading={loading} loadingLabel="Sending…">
              Send code
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
          <Button type="submit" className="w-full" loading={loading} disabled={code.length !== 6} loadingLabel="Verifying…">
            Verify & continue
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              className="text-muted transition hover:text-terra disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-muted"
              onClick={onResend}
              disabled={loading || cooldown > 0}
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
            <button
              type="button"
              className="text-muted transition hover:text-terra"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
                setMessage(null);
                setDevCode(null);
              }}
            >
              Use a different email
            </button>
          </div>
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

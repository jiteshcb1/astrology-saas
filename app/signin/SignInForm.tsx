"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestOtp } from "./actions";

export function SignInForm() {
  const router = useRouter();
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
    router.push("/post-auth");
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => signIn("google", { callbackUrl: "/post-auth" })}
      >
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-sand/40">
        <span className="h-px flex-1 bg-line-dark" /> or <span className="h-px flex-1 bg-line-dark" />
      </div>

      {step === "email" ? (
        <form onSubmit={onRequest} className="space-y-4">
          <Input
            tone="dark"
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
      ) : (
        <form onSubmit={onVerify} className="space-y-4">
          <Input
            tone="dark"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            label={`Enter the 6-digit code sent to ${email}`}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            required
          />
          <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
            {loading ? "Verifying…" : "Verify & continue"}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-sand/60 hover:text-sand"
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

      {message && <p className="text-sm text-green">{message}</p>}
      {devCode && <p className="text-xs text-marigold-soft">[dev] code: {devCode}</p>}
      {error && <p className="text-sm text-terra">{error}</p>}
    </div>
  );
}

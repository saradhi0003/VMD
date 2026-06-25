"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@vmd/supabase";

export default function MfaChallengePage() {
  return (
    <Suspense fallback={null}>
      <MfaChallenge />
    </Suspense>
  );
}

function MfaChallenge() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createBrowserClient();
      if (!supabase) {
        setError("Authentication is temporarily unavailable. Please try again.");
        setLoading(false);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/owner/login");
        return;
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.find((f) => f.status === "verified");
      if (!verified) {
        router.replace(`/mfa/enroll?next=${encodeURIComponent(next)}`);
        return;
      }
      setFactorId(verified.id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const supabase = createBrowserClient();
    if (!supabase) {
      setError("Authentication is temporarily unavailable.");
      setBusy(false);
      return;
    }
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !ch) {
      setError(chErr?.message ?? "Challenge failed.");
      setBusy(false);
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() });
    if (vErr) {
      setError("That code didn't match. Use the current code from your authenticator app.");
      setBusy(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function signOut() {
    const supabase = createBrowserClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/owner/login");
  }

  return (
    <div className="mx-auto mt-24 max-w-md px-6">
      <div className="rounded-card border border-line bg-white p-8">
        <p className="eyebrow">Security · verify it's you</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">Enter your code</h1>
        <p className="mt-2 text-sm text-ink-2">Open your authenticator app and enter the current 6-digit code.</p>

        {loading ? (
          <div className="mt-6 h-12 animate-pulse rounded-tile bg-surface" />
        ) : (
          <form onSubmit={onVerify} className="mt-6 space-y-3">
            <input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              className="w-full rounded-tile border border-line bg-white px-4 py-3 text-center text-lg tracking-[0.4em] text-ink outline-none focus:border-blue focus:ring-2 focus:ring-blue/20"
            />
            {error && <p className="rounded-tile bg-warn/10 p-3 text-sm text-warn">{error}</p>}
            <button
              type="submit"
              disabled={busy || code.trim().length < 6}
              className="min-h-[52px] w-full rounded-pill bg-navy font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button type="button" onClick={signOut} className="w-full text-center text-sm text-ink-2 hover:text-ink">
              Sign in as someone else
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@vmd/supabase";

export default function MfaEnrollPage() {
  return (
    <Suspense fallback={null}>
      <MfaEnroll />
    </Suspense>
  );
}

function MfaEnroll() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";

  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/owner/login");
        return;
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors?.totp?.some((f) => f.status === "verified")) {
        router.replace(`/mfa?next=${encodeURIComponent(next)}`);
        return;
      }
      // clean up any half-finished factors, then enrol fresh
      for (const f of factors?.all ?? []) {
        if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error: enrErr } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `authenticator-${Date.now()}`,
      });
      if (enrErr || !data) {
        setError(enrErr?.message ?? "Could not start MFA enrolment.");
        setLoading(false);
        return;
      }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !ch) {
      setError(chErr?.message ?? "Challenge failed.");
      setBusy(false);
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() });
    if (vErr) {
      setError("That code didn't match. Try the current code from your app.");
      setBusy(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="mx-auto mt-20 max-w-md px-6">
      <div className="rounded-card border border-line bg-white p-8">
        <p className="eyebrow">Security · step up</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">Set up your authenticator</h1>
        <p className="mt-2 text-sm text-ink-2">
          Scan this code with Google Authenticator, Authy or 1Password, then enter the 6-digit code it shows.
        </p>

        {loading ? (
          <div className="mt-6 h-44 animate-pulse rounded-tile bg-surface" />
        ) : (
          <>
            {qr && (
              <div className="mt-6 flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="MFA QR code" className="h-44 w-44 rounded-tile border border-line bg-white p-2" />
                {secret && (
                  <p className="font-mono text-xs text-ink-3">
                    or enter key: <span className="select-all text-ink-2">{secret}</span>
                  </p>
                )}
              </div>
            )}
            <form onSubmit={onVerify} className="mt-6 space-y-3">
              <input
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
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
                {busy ? "Verifying…" : "Verify & continue"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

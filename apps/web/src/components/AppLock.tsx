"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appPlugin, biometricPlugin, isNativeApp } from "@/lib/capacitor";
import { BrandLogo } from "@/components/ui";

/**
 * Biometric app lock for the native shell (Feature C).
 *
 * Mobile session policy differs from web: on a phone we *stay signed in* (no
 * one wants to retype a PIN in a cowshed at 5am) and instead re-lock the UI on
 * cold start and whenever the app returns from the background. Ported from
 * FinTracker's `app/lib/useAppLock.ts` + `screens/BiometricLock.tsx`.
 *
 * THE CRITICAL RULE, carried over verbatim: **if biometrics aren't available or
 * aren't enrolled, let the user in.** This is a convenience layer over a session
 * that is already protected by AAL2 + RLS. Hard-locking someone out of their own
 * farm because their fingerprint sensor broke would be a bug, not security.
 *
 * Renders nothing on the web — `isNativeApp()` is false in every browser.
 */

const LOCK_AFTER_BACKGROUND_MS = 60_000;

export function AppLock() {
  const [native, setNative] = useState(false);
  const [locked, setLocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const unlocking = useRef(false);

  const unlock = useCallback(async () => {
    if (unlocking.current) return;
    unlocking.current = true;
    setFailed(false);

    const bio = biometricPlugin();
    // No plugin, or no enrolled biometric → open the door. See the rule above.
    if (!bio) {
      setLocked(false);
      unlocking.current = false;
      return;
    }
    try {
      const { isAvailable } = await bio.isAvailable();
      if (!isAvailable) {
        setLocked(false);
        unlocking.current = false;
        return;
      }
      await bio.verifyIdentity({
        title: "Vayumukhi Dairy",
        subtitle: "Unlock to continue",
        reason: "Confirm it's you",
        useFallback: true, // device passcode if the biometric read fails
      });
      setLocked(false);
    } catch {
      // Cancelled or not recognised — stay locked, offer a retry.
      setFailed(true);
    } finally {
      unlocking.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    setNative(true);
    setLocked(true);
    void unlock(); // cold start prompts immediately

    let remove: (() => void) | undefined;
    void appPlugin()
      ?.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          backgroundedAt.current = Date.now();
          return;
        }
        // Only re-lock if it was away long enough to be a real context switch —
        // a notification shade pull shouldn't demand a fingerprint.
        const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        backgroundedAt.current = null;
        if (away >= LOCK_AFTER_BACKGROUND_MS) {
          setLocked(true);
          void unlock();
        }
      })
      .then((h) => {
        remove = h.remove;
      });

    return () => remove?.();
  }, [unlock]);

  if (!native || !locked) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-navy px-8 text-center">
      <BrandLogo size={64} />
      <div>
        <p className="font-serif text-2xl text-white">Vayumukhi Dairy</p>
        <p className="mt-2 text-sm text-white/70">
          {failed ? "Unlock cancelled." : "Unlock to continue"}
        </p>
      </div>
      {failed && (
        <button
          type="button"
          onClick={() => void unlock()}
          className="min-h-[52px] rounded-pill bg-white px-8 font-semibold text-navy"
        >
          Try again
        </button>
      )}
    </div>
  );
}

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

    let bio: ReturnType<typeof biometricPlugin> = null;
    try {
      bio = biometricPlugin();
    } catch {
      bio = null;
    }
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
    let native = false;
    try {
      native = isNativeApp();
    } catch {
      return; // no bridge, or a bridge that throws on probe — behave like the web
    }
    if (!native) return;

    setNative(true);
    setLocked(true);
    void unlock(); // cold start prompts immediately

    let remove: (() => void) | undefined;

    const onStateChange = ({ isActive }: { isActive: boolean }) => {
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
    };

    try {
      // The injected bridge is not the npm package: depending on Capacitor
      // version and whether the plugin is registered natively, addListener may
      // hand back a Promise OR the handle itself. Blindly calling .then() on the
      // latter throws inside the effect and takes the whole route down.
      const handle = appPlugin()?.addListener("appStateChange", onStateChange) as
        | { then?: unknown; remove?: () => void }
        | undefined;

      if (handle && typeof handle.then === "function") {
        void (handle as Promise<{ remove: () => void }>)
          .then((h) => {
            remove = h?.remove;
          })
          .catch(() => {});
      } else if (handle && typeof handle.remove === "function") {
        remove = handle.remove.bind(handle);
      }
    } catch (err) {
      // Background re-lock is a nicety; losing it must not lose the screen.
      console.warn("[AppLock] appStateChange listener unavailable:", err);
    }

    return () => {
      try {
        remove?.();
      } catch {
        /* ignore */
      }
    };
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

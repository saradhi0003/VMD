"use client";

import { useEffect, useRef } from "react";
import { createBrowserClient } from "@vmd/supabase";

/**
 * Session lifetime Supabase won't enforce for you.
 *
 * Supabase refreshes a JWT forever while a tab stays open, so a phone left on
 * the milk-log screen in a cowshed stays signed in indefinitely. This signs out
 * after 20 minutes without activity.
 *
 * Ported from FinTracker's `app/lib/useIdleLogout.ts` (React Native) to the DOM.
 * Two non-obvious details carried over verbatim, both learned the hard way:
 *
 *  1. The clock is **persisted to localStorage**, not just held in a ref. Mobile
 *     browsers evict tabs constantly; without persistence every restore reset
 *     the clock to "now" and the session never actually expired.
 *  2. Two racers — a 30 s interval **and** a visibilitychange check — because
 *     mobile browsers freeze timers while backgrounded, so the interval alone
 *     cannot notice a gap. Time spent backgrounded counts as idle.
 */
export const IDLE_LOGOUT_MS = 20 * 60 * 1000;

const STAMP_KEY = "vmd:last-activity";
const STAMP_THROTTLE_MS = 15_000; // don't hit storage on every mousemove

// Safari private mode throws on localStorage — never let that sign someone out.
function readStamp(): number | null {
  try {
    const v = window.localStorage.getItem(STAMP_KEY);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
function writeStamp(at: number) {
  try {
    window.localStorage.setItem(STAMP_KEY, String(at));
  } catch {
    /* ignore */
  }
}
function clearStamp() {
  try {
    window.localStorage.removeItem(STAMP_KEY);
  } catch {
    /* ignore */
  }
}

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove"] as const;

export function useIdleLogout(enabled: boolean, onTimeout: () => void) {
  const last = useRef(Date.now());
  const written = useRef(0);
  const fired = useRef(false);
  const wasEnabled = useRef(false);
  const cb = useRef(onTimeout);
  cb.current = onTimeout;

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!enabled) {
      // Clear on a real sign-out so the next login starts fresh — but not on
      // first paint, where the session isn't restored yet and the stored stamp
      // is exactly what we still need to read.
      if (wasEnabled.current) clearStamp();
      wasEnabled.current = false;
      return;
    }
    wasEnabled.current = true;
    fired.current = false;

    const expire = () => {
      if (fired.current) return; // interval + visibility can race
      fired.current = true;
      clearStamp();
      // Signing out is best-effort: if the Supabase client can't be built (a
      // WebView with storage restrictions, a missing env var), still send the
      // user to the login screen rather than throwing out of the timer.
      try {
        void createBrowserClient()?.auth.signOut();
      } catch (err) {
        console.warn("[idle-logout] signOut failed:", err);
      }
      try {
        cb.current();
      } catch (err) {
        console.warn("[idle-logout] redirect failed:", err);
      }
    };

    // A restored session inherits the stored clock: if the tab was closed or
    // the phone asleep longer than the window, that idle time still counts.
    const restored = readStamp();
    if (restored != null && Date.now() - restored > IDLE_LOGOUT_MS) {
      expire();
      return;
    }

    last.current = Date.now(); // opening the app is itself activity
    written.current = last.current;
    writeStamp(last.current);

    const touch = () => {
      last.current = Date.now();
      if (last.current - written.current >= STAMP_THROTTLE_MS) {
        written.current = last.current;
        writeStamp(last.current);
      }
    };

    const check = () => {
      if (fired.current) return;
      // Another tab may hold a fresher timestamp — trust the newest.
      const stored = readStamp();
      const at = stored != null && stored > last.current ? stored : last.current;
      if (Date.now() - at > IDLE_LOGOUT_MS) expire();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        written.current = last.current;
        writeStamp(last.current);
      } else {
        check();
      }
    };

    for (const e of ACTIVITY_EVENTS) window.addEventListener(e, touch, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onVisibility);
    const timer = setInterval(check, 30_000);

    return () => {
      clearInterval(timer);
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, touch);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onVisibility);
    };
  }, [enabled]);
}

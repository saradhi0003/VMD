/**
 * Thin, dependency-free access to the Capacitor native bridge.
 *
 * The mobile shell (`mobile/`) loads the *hosted* web app via `server.url`
 * rather than bundling it, so Capacitor injects `capacitor.js` into the page at
 * runtime and exposes natively-registered plugins on `window.Capacitor.Plugins`.
 *
 * That means the web app can call native plugins **without adding the plugin's
 * npm package to `apps/web`** — the native side registers them, we just look
 * them up. Everything here degrades to "not native" in a normal browser, so the
 * same code ships to Vercel untouched.
 */

interface BiometricAvailability {
  isAvailable: boolean;
  biometryType?: number;
}

interface NativeBiometricPlugin {
  isAvailable(): Promise<BiometricAvailability>;
  verifyIdentity(opts: {
    reason?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    useFallback?: boolean;
  }): Promise<void>;
}

interface AppPlugin {
  addListener(
    event: "appStateChange",
    cb: (state: { isActive: boolean }) => void,
  ): Promise<{ remove: () => void }>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    NativeBiometric?: NativeBiometricPlugin;
    App?: AppPlugin;
    [k: string]: unknown;
  };
}

function cap(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

/** True only inside the iOS/Android shell — false in every browser, including mobile web. */
export function isNativeApp(): boolean {
  return cap()?.isNativePlatform?.() === true;
}

export function nativePlatform(): "ios" | "android" | "web" {
  const p = cap()?.getPlatform?.();
  return p === "ios" || p === "android" ? p : "web";
}

export function biometricPlugin(): NativeBiometricPlugin | null {
  return cap()?.Plugins?.NativeBiometric ?? null;
}

export function appPlugin(): AppPlugin | null {
  return cap()?.Plugins?.App ?? null;
}

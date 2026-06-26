import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor native shell for Vayumukhi Dairy (iOS + Android).
 *
 * It loads the hosted Next.js app (server.url) inside a native WebView, adding
 * native camera (Smart Scan), push notifications, and deep links. No static
 * export of the SSR app is needed.
 *
 * Before building: set `server.url` to your production domain, and add the
 * deep-link scheme + that URL to Supabase Auth → Redirect URLs (see README).
 */
const config: CapacitorConfig = {
  appId: "in.vayumukhi.app",
  appName: "Vayumukhi Dairy",
  webDir: "www",
  server: {
    url: "https://vmd-nu.vercel.app", // ← change to your custom domain in production
    cleartext: false,
    allowNavigation: ["vmd-nu.vercel.app", "*.supabase.co"],
  },
  ios: {
    contentInset: "always",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#173a5c",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;

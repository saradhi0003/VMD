import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Schibsted_Grotesk, Spline_Sans_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const mono = Spline_Sans_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vayumukhi Dairy | Milk you can trace to the field",
  description:
    "Vayumukhi Dairy — a family-owned Indian dairy. We grow our own fodder, we name our cows, and we track every litre — from the shed to your door.",
  manifest: "/manifest.webmanifest",
  applicationName: "Vayumukhi Dairy",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Vayumukhi" },
  // iOS does NOT render SVG for the home-screen icon — an SVG-only `apple` entry
  // gets you a grey placeholder or a screenshot of the page instead of the brand
  // mark. It needs a real 180×180 PNG.
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/logo.svg",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#173a5c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-bg font-sans text-ink antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

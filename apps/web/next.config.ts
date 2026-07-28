import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Pin the monorepo root. Without this Next guesses it from lockfile location
  // and warns on every build; the guess also decides which files get traced
  // into the serverless bundle, so an incorrect one can drop workspace deps.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  experimental: {
    // Must stay ABOVE MAX_UPLOAD_BYTES in src/lib/upload.ts (10 MB) so an
    // oversized photo hits our validator and gets a readable message, rather
    // than being rejected here as an opaque 413.
    serverActions: { bodySizeLimit: "12mb" },
  },
  transpilePackages: ["@vmd/supabase", "@vmd/llm", "@vmd/jobs"],
  // Workspace packages use NodeNext ESM imports (e.g. "./browser.js") that point
  // at .ts sources. Teach webpack to resolve those extensions.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "img-src 'self' data: blob: https://*.supabase.co https://*.public.blob.vercel-storage.com",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              // Supabase REST/Auth (https) + Realtime (wss) must be allowed for the browser client.
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.inngest.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default config;

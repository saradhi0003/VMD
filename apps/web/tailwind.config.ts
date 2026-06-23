import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#ffffff",
        surface: {
          DEFAULT: "#f6f9fb",
          alt: "#eaf3fa",
        },
        line: "rgba(0,0,0,0.08)",
        ink: {
          DEFAULT: "#14202b",
          2: "#5a6772",
          3: "#8a96a0",
        },
        navy: {
          DEFAULT: "#173a5c",
          deep: "#0d1820",
        },
        blue: "#3f93cf",
        ok: "#1f8a5b",
        warn: "#c2722f",
        // Back-compat aliases remapped to the Pure palette so any un-migrated
        // `farm-*` / `marigold` class still renders on-brand.
        farm: {
          green: "#173a5c",
          marigold: "#3f93cf",
          cream: "#f6f9fb",
          ink: "#14202b",
        },
        marigold: "#3f93cf",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "18px",
        tile: "14px",
        pill: "999px",
      },
      boxShadow: {
        float: "0 1px 3px rgba(0,0,0,0.08)",
      },
    },
  },
} satisfies Config;

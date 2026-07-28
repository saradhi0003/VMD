# Archive

Files kept for reference but **not part of the build**. Nothing here is imported, served, or
deployed. Safe to delete entirely — it's preserved only because it may be useful to look back at.

Everything was moved with `git mv`, so full history survives:
```bash
git log --follow archive/prototype-2026-05/index.html
```

---

## `prototype-2026-05/` — the original static prototype

The hand-written HTML/CSS/JS version of Vayumukhi Dairy that predates the Next.js app. Last touched
May 2026 (commits `a64637c`, `115f913`); superseded by `apps/web/` in June.

| File | Was |
|---|---|
| `index.html` | marketing site → now `apps/web/src/app/page.tsx` |
| `app.html` + `app.js` | owner workspace → now `apps/web/src/app/owner/*` |
| `worker.html` + `worker.js` | worker workspace → now `apps/web/src/app/worker/*` |
| `styles.css` | 99 KB of hand-rolled CSS → now Tailwind + the Pure tokens in `globals.css` |
| `manifest.webmanifest`, `service-worker.js` | PWA shell → now `apps/web/public/{manifest.webmanifest,sw.js}` |
| `assets/` | image source folder |

**Why it was safe to move:** the cluster is entirely self-contained (`index.html` links only to
`app.html`, `worker.html`, `styles.css`, `manifest.webmanifest` and `assets/`), nothing in `apps/`,
`packages/`, `supabase/` or `mobile/` references it, and there is no `vercel.json` or other deploy
config that would serve the repo root as static files — Vercel builds `apps/web`.

**On `assets/`:** six of its nine images were byte-identical duplicates of files already in
`apps/web/public/` (verified by SHA-1). The other three — `product-butter.jpg`, `product-lassi.jpg`,
`product-paneer.jpg` — were referenced only by the prototype's `index.html`. If you ever add butter,
lassi or paneer to the live product grid, those three are here waiting.

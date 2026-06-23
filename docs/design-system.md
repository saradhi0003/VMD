# Design system — "Pure"

Navy / sky-blue / white, thin serif display, mono micro-labels. Tokens in
`apps/web/src/app/globals.css` (`:root`) + `apps/web/tailwind.config.ts`. **No off-palette colours or fonts.**

## Tokens (use the Tailwind names)
- Surfaces: `bg` (#fff), `surface` (#f6f9fb), `surface-alt` (#eaf3fa), `line` (hairline border)
- Ink: `ink` (#14202b), `ink-2` (#5a6772), `ink-3` (#8a96a0)
- Brand: `navy` (#173a5c), `navy-deep`, `blue` (#3f93cf)
- Status: `ok` (#1f8a5b), `warn` (#c2722f)
- Radius: `rounded-card` (18px), `rounded-tile` (14px), `rounded-pill`. Shadow: reserve for floating only.
- Legacy `farm-*`/`marigold` classes are remapped to Pure values (safety net) — prefer the new tokens.

## Type (loaded via `next/font` in `app/layout.tsx`)
- `font-serif` → Instrument Serif — display headlines + the **one big number** per card.
- `font-sans` → Schibsted Grotesk — all UI/body (default).
- `font-mono` → Spline Sans Mono — eyebrows, metadata, values, timestamps.
- `.eyebrow` utility = mono 11px uppercase tracked label.

## UI kit — `@/components/ui` (import from the barrel)
`Button` (pill; primary/secondary/tertiary/danger, md/lg) · `Card`/`CardHeader`/`EmptyState` ·
`StatCard` (KPI tile w/ sparkline slot) · `Field`/`Input`/`Select`/`Textarea` · `SeverityBadge` ·
`PageHeader`/`BackLink` · `PlaceholderImage` · `BrandLogo` (renders `/logo.svg`) · product art
(`MilkArt`/`CurdArt`/`GheeArt`/`FarmScene` — SVG fallbacks, currently unused on `/`).

## Charts — `@/components/charts/`
Recharts. **Import the lazy wrappers** from `charts/lazy` (`MilkTrendChart`, `RevenueExpenseChart`,
`Sparkline`) — they `dynamic(ssr:false)` so Recharts doesn't bloat first load. Colours: navy `#173a5c`,
blue `#3f93cf`.

## Images
Real photos live in `apps/web/public/` (product-*.jpg, hero, whyus-fodder). Use **`next/image`** with
`fill` + `sizes` inside a `relative` box (optimises + lazy-loads; the hero PNG is multi-MB raw).

## Do / Don't
- ✅ Hairline-bordered white cards, serif headings, mono eyebrows, pill buttons, one big serif number per card.
- ❌ Drop shadows on static cards, warm/cream tones, gradients (except the navy hero), money/analytics in
  the worker app.

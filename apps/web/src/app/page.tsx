import Link from "next/link";
import Image from "next/image";
import { BrandLogo } from "@/components/ui";

const IMG: Record<string, string> = {
  milk: "/product-milk.jpg",
  curd: "/product-curd.jpg",
  ghee: "/product-ghee.jpg",
};

/**
 * Marketing landing page — "Pure" design system (navy / blue / white, thin
 * serif display, mono micro-labels). Static, no backend. Copy is the honest
 * first-person family voice; numbers match the real farm (§1).
 */
export default function HomePage() {
  return (
    <main className="bg-bg">
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandLogo size={40} />
            <span className="font-bold tracking-tight text-ink">Vayumukhi</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-ink-2 md:flex">
            <Link href="#story" className="hover:text-ink">Our Story</Link>
            <Link href="#products" className="hover:text-ink">Products</Link>
            <Link href="#why" className="hover:text-ink">Why Us</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/worker/login" className="text-sm text-ink-2 hover:text-ink">Worker</Link>
            <Link href="/owner" className="rounded-pill bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep">
              Owner login
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-6 pb-8 pt-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-pill bg-surface-alt px-3 py-1 text-xs font-medium text-navy">
          <span className="h-1.5 w-1.5 rounded-full bg-blue" /> Delivered fresh, twice a day
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl font-serif text-5xl leading-[1.02] tracking-tight text-ink md:text-[4.75rem]">
          Milk you can trace to the <span className="italic text-blue">field.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-ink-2">
          We grow our own fodder, we name our cows, and we track every litre — from the shed to your door.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="#products" className="rounded-pill bg-navy px-6 py-3 text-sm font-semibold text-white hover:bg-navy-deep">
            Explore products
          </Link>
          <Link href="#story" className="rounded-pill border-[1.5px] border-line bg-white px-6 py-3 text-sm font-semibold text-ink hover:bg-surface">
            Read our story
          </Link>
        </div>

        {/* product strip */}
        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            { name: "Fresh Whole Milk", src: "/product-milk.jpg" },
            { name: "Thick Curd (Dahi)", src: "/product-curd.jpg" },
            { name: "Cultured Ghee", src: "/product-ghee.jpg" },
          ].map(({ name, src }) => (
            <div key={name} className="overflow-hidden rounded-card border border-line bg-white text-left">
              <div className="relative h-44">
                <Image src={src} alt={name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
              </div>
              <p className="px-4 py-3 font-semibold text-ink">{name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trust band ── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 divide-line rounded-card border border-line bg-white md:grid-cols-4 md:divide-x">
          {[
            ["220L", "Daily production"],
            ["34", "Animals with records"],
            ["100%", "Own-grown fodder"],
            ["< 3h", "Cow to doorstep"],
          ].map(([n, l]) => (
            <div key={l} className="px-6 py-7 text-center">
              <div className="font-serif text-4xl text-ink">{n}</div>
              <div className="mt-1 text-sm text-ink-2">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Capabilities ── */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">One farm, fully run</p>
            <h2 className="mt-3 font-serif text-4xl leading-tight text-ink md:text-5xl">
              Every litre accounted for — from the shed to your door.
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink-2">
              Behind every bottle is a system: two milkings logged per animal, a daily AI farm-check, and an
              open ledger you can trace. This is how a family farm runs like clockwork.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["🥛", "Production tracking", "Two milkings a day, per animal, with fat % and 14-day trends."],
              ["🐄", "Herd records", "Every animal's health card, feed plan and yield — names, not numbers."],
              ["🤖", "Daily AI farm-check", "An agent flags missing entries, dipping fat %, and quiet customers each morning."],
              ["💬", "WhatsApp alerts", "Owners get nudged where they already are — no new app to learn."],
              ["₹", "Sales & customers", "Daily sales by route, with reminders when a regular goes quiet."],
              ["📒", "Open ledger", "Append-only records, corrected by reversal — traceable back to the field."],
            ].map(([icon, title, body]) => (
              <div key={title} className="rounded-card border border-line bg-white p-6">
                <span className="grid h-10 w-10 place-items-center rounded-tile bg-surface-alt text-lg text-navy" aria-hidden>{icon}</span>
                <h3 className="mt-4 font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Story ── */}
      <section id="story" className="mx-auto max-w-6xl px-6 py-20">
        <p className="eyebrow">Our story</p>
        <h2 className="mt-3 max-w-2xl font-serif text-4xl leading-tight text-ink md:text-5xl">
          Three generations. One farm. One promise.
        </h2>

        <div className="mt-10 grid items-center gap-10 md:grid-cols-2">
          <div className="space-y-4 text-[17px] leading-relaxed text-ink-2">
            <p>
              It began in 1978 with my grandfather, <span className="text-ink">two cows and one brass can</span>.
              He woke before the temple bell, cut green grass from our own field by hand, and milked by lantern
              light. Every litre went into a cloth-bound notebook — because in our village, a farmer&apos;s word is
              only as good as his record.
            </p>
            <p>
              My father added the buffaloes and the morning delivery round. He gave each animal a name, knew which
              cow wanted her neck scratched before she&apos;d let down her milk, and would never sell a drop he
              wouldn&apos;t pour for his own children. Neighbours started asking for &ldquo;Vayumukhi milk&rdquo; by name.
            </p>
            <p>
              Today the notebook is a phone — but nothing else has changed. We still grow the fodder in our fields.
              We still know all <span className="text-ink">34 animals by name</span>. We still milk twice a day and
              bottle within the hour, while the milk is still warm from the shed.
            </p>
            <p className="text-ink">
              Clean milk, from animals we love, written down honestly, delivered to your door the same morning.
              That is the whole promise.
            </p>
            <p className="font-serif text-2xl italic text-navy">— The Vayumukhi family.</p>
          </div>

          <div className="relative h-72 overflow-hidden rounded-card border border-line md:h-full md:min-h-[20rem]">
            <Image src="/whyus-fodder.jpg" alt="Home-grown fodder fields" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            ["Animals first", "Every cow has a name, a birthday and a health card. We know them — they are not numbers."],
            ["Our own fodder", "We grow the grass our animals eat. No shortcuts, no mystery feed — just what we'd want for our own."],
            ["Open records", "Every litre is written down, every day. The paper is the source of truth; the phone is the copy."],
          ].map(([t, b]) => (
            <div key={t} className="rounded-card border border-line bg-white p-6">
              <h3 className="font-serif text-2xl text-ink">{t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Products ── */}
      <section id="products" className="mx-auto max-w-6xl px-6 py-20">
        <p className="eyebrow">What we make</p>
        <h2 className="mt-3 font-serif text-4xl leading-tight text-ink md:text-5xl">Three things, done properly.</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            {
              tag: "milk",
              name: "Fresh Whole Milk",
              desc: "Unhomogenised, lightly pasteurised — bottled the same hour it leaves the cow.",
              meta: [["Fat", "4.0–4.5%"], ["SNF", "8.5%+"], ["Pack", "500ml & 1L glass"]],
            },
            {
              tag: "curd",
              name: "Thick Curd (Dahi)",
              desc: "Set overnight — never sour. Thick enough to hold a spoon upright.",
              meta: [["Fat", "4%+"], ["Set", "Overnight"], ["Pack", "200g & 400g"]],
            },
            {
              tag: "ghee",
              name: "Cultured Ghee",
              desc: "Cream cultured 12 hours, churned, slow-cooked to a deep amber.",
              meta: [["Source", "A2 cream"], ["Shelf", "~9 months"], ["Pack", "250ml & 500ml"]],
            },
          ].map((p) => {
            const src = IMG[p.tag] ?? "/product-milk.jpg";
            return (
            <div key={p.name} className="overflow-hidden rounded-card border border-line bg-white">
              <div className="relative h-44">
                <Image src={src} alt={p.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
              </div>
              <div className="p-6">
                <span className="eyebrow">{p.tag}</span>
                <h3 className="mt-1 font-serif text-2xl text-ink">{p.name}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{p.desc}</p>
                <dl className="mt-4 space-y-1.5 border-t border-line pt-4">
                  {p.meta.map(([k, v]) => (
                    <div key={k} className="flex justify-between font-mono text-xs">
                      <dt className="text-ink-3">{k}</dt>
                      <dd className="text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            );
          })}
        </div>
      </section>

      {/* ── Why Us ── */}
      <section id="why" className="mx-auto max-w-6xl px-6 py-20">
        <p className="eyebrow">Why us</p>
        <h2 className="mt-3 max-w-2xl font-serif text-4xl leading-tight text-ink md:text-5xl">
          The proof is in the ledger.
        </h2>

        <div className="mt-12 grid items-center gap-10 md:grid-cols-2">
          <div>
            <h3 className="font-serif text-2xl text-ink">Every litre, written down.</h3>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-ink-2">
              Two milkings a day, every animal noted by name. Here is one morning, exactly as it was recorded.
            </p>
          </div>
          <div className="rounded-card border border-line bg-white p-5">
            <p className="eyebrow mb-3">Morning ledger · today</p>
            <ul className="space-y-2 font-mono text-sm">
              {[
                ["Lakshmi", "7.2L · 4.3%"],
                ["Ganga", "6.8L · 4.1%"],
                ["Saraswati", "8.1L · 4.5%"],
                ["Yamuna", "7.6L · 4.2%"],
              ].map(([n, v]) => (
                <li key={n} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-ink"><span className="h-1.5 w-1.5 rounded-full bg-blue" />{n}</span>
                  <span className="text-ink-2">{v}</span>
                </li>
              ))}
              <li className="flex items-center justify-between border-t border-line pt-2 font-semibold text-ink">
                <span>Total</span>
                <span>187.4L</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 grid items-center gap-10 md:grid-cols-2">
          <div className="order-2 md:order-1 rounded-card border border-line bg-white p-6">
            <p className="eyebrow mb-4">From shed to door</p>
            <ol className="space-y-4">
              {[
                ["5:30", "Milking"],
                ["6:30", "Bottling & QC"],
                ["7:00", "Routes leave"],
                ["8:30", "At your door"],
              ].map(([t, l]) => (
                <li key={t} className="flex items-center gap-4">
                  <span className="font-mono text-sm text-blue">{t}</span>
                  <span className="text-[15px] text-ink">{l}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="order-1 md:order-2">
            <h3 className="font-serif text-2xl text-ink">Cow to kitchen, same morning.</h3>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-ink-2">
              Under three hours from the shed to your door. We check the vet before the medicine, the feed before
              the yield — and we write all of it down.
            </p>
          </div>
        </div>

        <div className="mt-16 rounded-card bg-navy p-8 text-white md:p-12">
          <p className="font-serif text-3xl leading-snug md:text-4xl">
            “We grow our fodder. We name our cows. We track every litre, every day.”
          </p>
          <p className="mt-4 text-white/70">— The Vayumukhi family.</p>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="eyebrow">In their words</p>
          <h2 className="mt-3 font-serif text-4xl leading-tight text-ink md:text-5xl">Families and kitchens that switched.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              ["“My kids actually finish their milk now — I can taste the difference.”", "Anitha", "Customer · North lane"],
              ["“Same time every morning, glass bottles, curd that's never sour. We moved the whole kitchen over.”", "Hotel Annapurna", "Wholesale · Market"],
              ["“I see the day's milk and money on my phone before breakfast. That changed everything.”", "Ramesh", "Owner · Vayumukhi"],
            ].map(([quote, name, role]) => (
              <figure key={name} className="flex flex-col rounded-card border border-line bg-white p-6">
                <blockquote className="flex-1 font-serif text-xl leading-snug text-ink">{quote}</blockquote>
                <figcaption className="mt-5 border-t border-line pt-4">
                  <div className="font-semibold text-ink">{name}</div>
                  <div className="font-mono text-xs text-ink-3">{role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── App CTA ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-serif text-4xl leading-tight text-ink md:text-5xl">Two workspaces, one farm.</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Link href="/owner" className="group rounded-card border border-line bg-white p-7 transition hover:border-navy/30">
            <p className="eyebrow">For Ramesh</p>
            <h3 className="mt-2 font-serif text-2xl text-ink">Owner Workspace</h3>
            <p className="mt-2 text-[15px] text-ink-2">Production, herd, money, sales, reminders and the daily AI farm-check — the whole farm at a glance.</p>
            <span className="mt-4 inline-block text-sm font-semibold text-navy group-hover:underline">Open owner app →</span>
          </Link>
          <Link href="/worker/login" className="group rounded-card border border-line bg-white p-7 transition hover:border-navy/30">
            <p className="eyebrow">For the shed</p>
            <h3 className="mt-2 font-serif text-2xl text-ink">Worker Workspace</h3>
            <p className="mt-2 text-[15px] text-ink-2">Big buttons, one task at a time — log milk, feed and health with a tap, a photo, or your voice.</p>
            <span className="mt-4 inline-block text-sm font-semibold text-navy group-hover:underline">Open worker app →</span>
          </Link>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <p className="eyebrow">Good to know</p>
        <h2 className="mt-3 font-serif text-4xl leading-tight text-ink md:text-5xl">Questions, answered.</h2>
        <div className="mt-8 divide-y divide-line border-y border-line">
          {[
            ["Where do you deliver?", "Five routes across town, twice daily — morning and evening. Tell us your street and we'll let you know the next slot."],
            ["Is the milk pasteurised?", "Lightly, and never homogenised. It's bottled the same hour it leaves the cow, so the cream still rises."],
            ["How fresh is it, really?", "Under three hours from shed to door: milked at 5:30, bottled and quality-checked by 6:30, at your door by 8:30."],
            ["Can I trace my milk?", "Yes. Every litre is logged by animal and date in our ledger — and we'll happily show you the morning's record."],
            ["Do you take wholesale orders?", "We supply a few kitchens and stores on standing daily orders. Reach out and we'll set up a route."],
          ].map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold text-ink">
                {q}
                <span className="text-ink-3 transition group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5">
                <BrandLogo size={32} />
                <span className="font-bold tracking-tight text-ink">Vayumukhi</span>
              </div>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-2">
                A three-generation family dairy. Clean milk you can trace to the field.
              </p>
            </div>
            <FooterCol heading="Products" links={[["Fresh Whole Milk", "#products"], ["Thick Curd (Dahi)", "#products"], ["Cultured Ghee", "#products"]]} />
            <FooterCol heading="Company" links={[["Our story", "#story"], ["Why us", "#why"], ["Owner login", "/owner"], ["Worker app", "/worker/login"]]} />
            <FooterCol heading="Visit" links={[["Five delivery routes", "#"], ["Mon–Sun · twice daily", "#"], ["Talk to us", "#"]]} />
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-center sm:flex-row sm:text-left">
            <p className="text-sm text-ink-2">© {new Date().getFullYear()} Vayumukhi Dairy · Family farm. Clean milk. Every day.</p>
            <Link href="#" className="font-mono text-xs uppercase tracking-[0.14em] text-ink-3 hover:text-ink">Back to top ↑</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FooterCol({ heading, links }: { heading: string; links: [string, string][] }) {
  return (
    <div>
      <p className="eyebrow">{heading}</p>
      <ul className="mt-3 space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-sm text-ink-2 hover:text-ink">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

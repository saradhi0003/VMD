import Link from "next/link";

/** Back link for worker sub-pages. */
export function BackLink({ href = "/worker", label = "Back" }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm text-navy hover:opacity-80">
      <span aria-hidden>‹</span> {label}
    </Link>
  );
}

export function PageHeader({
  title,
  subtitle,
  backHref,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
}) {
  return (
    <div className="space-y-1">
      {backHref && <BackLink href={backHref} />}
      <h1 className="font-serif text-[1.7rem] leading-tight text-ink">{title}</h1>
      {subtitle && <p className="text-sm text-ink-2">{subtitle}</p>}
    </div>
  );
}

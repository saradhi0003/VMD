import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "tertiary" | "danger";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition " +
  "active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2";

const sizes: Record<Size, string> = {
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 text-base min-h-[56px]",
};

const variants: Record<Variant, string> = {
  primary: "bg-navy text-white hover:bg-navy-deep",
  secondary: "bg-white text-ink border-[1.5px] border-line hover:bg-surface",
  tertiary: "text-navy hover:bg-surface",
  danger: "bg-warn text-white hover:opacity-90",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button {...props} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} />;
}

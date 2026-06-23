/**
 * App logo mark. Renders /logo.svg (an on-brand cow badge that always exists).
 * To use your own logo, replace apps/web/public/logo.svg, or drop a raster at
 * apps/web/public/logo.png and change the src below.
 */
export function BrandLogo({ size = 36 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.svg"
      alt="Vayumukhi Milk Center"
      width={size}
      height={size}
      className="shrink-0 rounded-full object-contain"
      style={{ height: size, width: size }}
    />
  );
}

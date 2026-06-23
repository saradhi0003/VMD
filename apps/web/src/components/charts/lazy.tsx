"use client";

import dynamic from "next/dynamic";

/**
 * Lazily-loaded chart wrappers. Recharts is ~50kB+; deferring it (ssr:false)
 * keeps the data screens' initial JS small and paints a skeleton first.
 * Server components import these instead of the raw chart components.
 */
const Skeleton = ({ h = 240 }: { h?: number }) => (
  <div className="w-full animate-pulse rounded-tile bg-surface" style={{ height: h }} />
);

export const MilkTrendChart = dynamic(() => import("./MilkTrendChart").then((m) => m.MilkTrendChart), {
  ssr: false,
  loading: () => <Skeleton />,
});

export const RevenueExpenseChart = dynamic(() => import("./RevenueExpenseChart").then((m) => m.RevenueExpenseChart), {
  ssr: false,
  loading: () => <Skeleton />,
});

export const Sparkline = dynamic(() => import("./Sparkline").then((m) => m.Sparkline), {
  ssr: false,
  loading: () => <Skeleton h={40} />,
});

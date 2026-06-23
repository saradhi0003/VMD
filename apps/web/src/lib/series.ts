/** YYYY-MM-DD strings for the last `days` days, oldest first, ending today (farm-local enough for dashboards). */
export function lastNDates(days: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    out.push(new Date(now - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

/** Sum a numeric field bucketed by a day key (YYYY-MM-DD). */
export function sumByDay<T>(rows: T[], dateOf: (r: T) => string, valueOf: (r: T) => number): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = dateOf(r);
    m.set(k, (m.get(k) ?? 0) + valueOf(r));
  }
  return m;
}

/** Map a per-day total onto a fixed list of dates, filling gaps with 0. */
export function seriesFor(dates: string[], totals: Map<string, number>, round = 1): { date: string; value: number }[] {
  const f = Math.pow(10, round);
  return dates.map((date) => ({ date, value: Math.round((totals.get(date) ?? 0) * f) / f }));
}

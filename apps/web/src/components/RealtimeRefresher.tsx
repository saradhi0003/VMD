"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@vmd/supabase";

/**
 * Subscribes to Postgres changes on the given tables (scoped to one farm) and
 * triggers a Server Component refresh when anything changes. Data fetching stays
 * on the server (RLS-safe); this only signals "re-run the query".
 *
 * RLS still applies to realtime, so a user only receives events for their farm —
 * the explicit `farm_id` filter is an extra guard and reduces noise.
 */
export function RealtimeRefresher({ tables, farmId }: { tables: string[]; farmId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) return; // env unavailable → skip realtime, never crash the page
    const channel = supabase.channel(`rt:${farmId}:${tables.join(",")}`);

    const scheduleRefresh = () => {
      // Debounce bursts of changes into a single refresh.
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    };

    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `farm_id=eq.${farmId}` },
        scheduleRefresh,
      );
    }

    channel.subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
    // tables is a stable literal at each call site; join() keeps the dep simple.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId, tables.join(","), router]);

  return null;
}

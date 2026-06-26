"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export type MilkRow = { animal: string | null; litres: number | null; fatPct: number | null; shift: "morning" | "evening" | null };
export type FeedRow = { feedType: string | null; quantity: string | null; animal: string | null };

const emptyMilk = (): MilkRow => ({ animal: "", litres: null, fatPct: null, shift: null });
const emptyFeed = (): FeedRow => ({ feedType: "", quantity: "", animal: "" });

/** Editable review table for a scanned milk/feed sheet → posts rows as JSON to a confirm action. */
export function ScanReviewTable({
  kind,
  initial,
  scanId,
  action,
}: {
  kind: "milk" | "feed";
  initial: (MilkRow | FeedRow)[];
  scanId: string;
  action: (formData: FormData) => void;
}) {
  const [rows, setRows] = useState<(MilkRow | FeedRow)[]>(() =>
    initial.length ? initial : [kind === "milk" ? emptyMilk() : emptyFeed()],
  );

  const cell = "rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none focus:border-blue";
  const update = (i: number, patch: Record<string, unknown>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const addRow = () => setRows((rs) => [...rs, kind === "milk" ? emptyMilk() : emptyFeed()]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="scanId" value={scanId} />
      <input type="hidden" name="rows" value={JSON.stringify(rows)} />

      <div className="overflow-x-auto rounded-tile border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">
            {kind === "milk" ? (
              <tr>
                <th className="px-3 py-2 font-medium">Animal</th>
                <th className="px-3 py-2 font-medium">Litres</th>
                <th className="px-3 py-2 font-medium">Fat %</th>
                <th className="px-3 py-2 font-medium">Shift</th>
                <th className="px-2 py-2" />
              </tr>
            ) : (
              <tr>
                <th className="px-3 py-2 font-medium">Feed</th>
                <th className="px-3 py-2 font-medium">Quantity</th>
                <th className="px-3 py-2 font-medium">Animal</th>
                <th className="px-2 py-2" />
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line">
                {kind === "milk" ? (
                  <>
                    <td className="px-2 py-1.5"><input className={`${cell} w-28`} value={(r as MilkRow).animal ?? ""} onChange={(e) => update(i, { animal: e.target.value })} placeholder="name/tag" /></td>
                    <td className="px-2 py-1.5"><input className={`${cell} w-20`} type="number" step="0.1" value={(r as MilkRow).litres ?? ""} onChange={(e) => update(i, { litres: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                    <td className="px-2 py-1.5"><input className={`${cell} w-16`} type="number" step="0.1" value={(r as MilkRow).fatPct ?? ""} onChange={(e) => update(i, { fatPct: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                    <td className="px-2 py-1.5">
                      <select className={`${cell} w-24`} value={(r as MilkRow).shift ?? ""} onChange={(e) => update(i, { shift: e.target.value || null })}>
                        <option value="">—</option>
                        <option value="morning">Morning</option>
                        <option value="evening">Evening</option>
                      </select>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-2 py-1.5"><input className={`${cell} w-32`} value={(r as FeedRow).feedType ?? ""} onChange={(e) => update(i, { feedType: e.target.value })} placeholder="feed type" /></td>
                    <td className="px-2 py-1.5"><input className={`${cell} w-24`} value={(r as FeedRow).quantity ?? ""} onChange={(e) => update(i, { quantity: e.target.value })} placeholder="e.g. 20 kg" /></td>
                    <td className="px-2 py-1.5"><input className={`${cell} w-28`} value={(r as FeedRow).animal ?? ""} onChange={(e) => update(i, { animal: e.target.value })} placeholder="optional" /></td>
                  </>
                )}
                <td className="px-2 py-1.5 text-right">
                  <button type="button" onClick={() => removeRow(i)} aria-label="Remove row" className="text-ink-3 hover:text-warn">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={addRow} className="text-sm font-semibold text-navy hover:underline">+ Add row</button>
        <Button type="submit">Confirm {rows.length} {kind === "milk" ? "milk" : "feed"} {rows.length === 1 ? "entry" : "entries"}</Button>
      </div>
    </form>
  );
}

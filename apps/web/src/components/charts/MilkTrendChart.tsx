"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface MilkPoint {
  date: string; // YYYY-MM-DD
  litres: number;
}

const fmtDay = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Milk production over time (area chart). */
export function MilkTrendChart({ data, height = 240 }: { data: MilkPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="milkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3f93cf" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3f93cf" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 12, fill: "#78716c" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "#78716c" }} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          labelFormatter={(l) => fmtDay(String(l))}
          formatter={(v) => [`${Number(v).toFixed(1)} L`, "Milk"]}
          contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 13 }}
        />
        <Area type="monotone" dataKey="litres" stroke="#3f93cf" strokeWidth={2} fill="url(#milkFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

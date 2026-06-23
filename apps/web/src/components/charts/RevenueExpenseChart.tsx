"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface MoneyPoint {
  date: string; // YYYY-MM-DD
  revenue: number;
  expense: number;
}

const fmtDay = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** Revenue vs expense, grouped bars. */
export function RevenueExpenseChart({ data, height = 240 }: { data: MoneyPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 12, fill: "#78716c" }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(v: number) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} tick={{ fontSize: 12, fill: "#78716c" }} tickLine={false} axisLine={false} width={44} />
        <Tooltip
          labelFormatter={(l) => fmtDay(String(l))}
          formatter={(v, name) => [rupees.format(Number(v)), name === "revenue" ? "Revenue" : "Expense"]}
          contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 13 }}
        />
        <Legend formatter={(v) => (v === "revenue" ? "Revenue" : "Expense")} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="revenue" fill="#173a5c" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" fill="#3f93cf" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

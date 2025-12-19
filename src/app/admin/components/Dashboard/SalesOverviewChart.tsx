"use client";

import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useListBillsQuery } from "@/store/billingApi";
import type { Bill } from "@/store/billingApi";

type ChartRow = {
  label: string;
  sales: number;
  units: number;
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function SalesOverviewChart() {
  const { data, isLoading } = useListBillsQuery({ search: "" });
  const bills = data?.bills ?? [];

  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number | "all">("all");

  /* -------------------- AVAILABLE YEARS -------------------- */
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    bills.forEach((b: Bill) =>
      set.add(new Date(b.billDate).getFullYear())
    );
    return Array.from(set).sort((a, b) => b - a);
  }, [bills]);

  /* -------------------- CHART DATA -------------------- */
  const chartData: ChartRow[] = useMemo(() => {
    const map = new Map<string, { sales: number; units: number }>();

    bills.forEach((bill: Bill) => {
      const date = new Date(bill.billDate);
      const billYear = date.getFullYear();
      const billMonth = date.getMonth();

      if (billYear !== year) return;
      if (month !== "all" && billMonth !== month) return;

      const key =
        month === "all"
          ? MONTHS[billMonth] // yearly view
          : date.getDate().toString(); // daily view

      const existing = map.get(key) ?? { sales: 0, units: 0 };
      existing.sales += bill.grandTotal ?? 0;
      existing.units += bill.totalItems ?? 0;

      map.set(key, existing);
    });

    return Array.from(map.entries()).map(([label, v]) => ({
      label,
      sales: v.sales,
      units: v.units,
    }));
  }, [bills, year, month]);

  return (
    <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-6 w-full">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Sales Overview
          </h2>
          <p className="text-sm text-gray-500">
            Sales & units based on selected period
          </p>
        </div>

        {/* FILTERS */}
        <div className="flex gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border px-3 py-1.5 text-sm outline-none"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={month}
            onChange={(e) =>
              setMonth(
                e.target.value === "all"
                  ? "all"
                  : Number(e.target.value)
              )
            }
            className="rounded-lg border px-3 py-1.5 text-sm outline-none"
          >
            <option value="all">All Months</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* CHART */}
      <div className="w-full h-64">
        {isLoading ? (
          <p className="text-center text-gray-400">Loading...</p>
        ) : chartData.length === 0 ? (
          <div className="flex justify-center items-center h-full text-gray-400 text-sm">
            No data for selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                }}
              />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="var(--color-primary)"
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="units"
                stroke="var(--color-secondary)"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="text-xs text-gray-400 mt-4 text-center">
        {month === "all"
          ? `Yearly view • ${year}`
          : `Daily view • ${MONTHS[month]} ${year}`}
      </div>
    </div>
  );
}

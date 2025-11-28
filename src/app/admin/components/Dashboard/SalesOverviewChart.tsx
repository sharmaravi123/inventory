"use client";

import React, { useMemo } from "react";
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
  month: string;
  sales: number;
  units: number;
};

const MONTHS: Record<number, string> = {
  0: "Jan",
  1: "Feb",
  2: "Mar",
  3: "Apr",
  4: "May",
  5: "Jun",
  6: "Jul",
  7: "Aug",
  8: "Sep",
  9: "Oct",
  10: "Nov",
  11: "Dec",
};

export default function SalesOverviewChart() {
  const { data, isLoading } = useListBillsQuery({ search: "" });
  const bills = data?.bills ?? [];

  const chartData: ChartRow[] = useMemo(() => {
    const map = new Map<number, { sales: number; units: number }>();

    bills.forEach((bill: Bill) => {
      const date = new Date(bill.billDate);
      const month = date.getMonth();

      const existing = map.get(month) ?? { sales: 0, units: 0 };

      existing.sales += bill.grandTotal;
      existing.units += bill.totalItems ?? 0;

      map.set(month, existing);
    });

    const result: ChartRow[] = [];
    map.forEach((v, k) => {
      result.push({
        month: MONTHS[k],
        sales: v.sales,
        units: v.units,
      });
    });

    result.sort(
      (a, b) =>
        Object.keys(MONTHS).indexOf(
          Object.values(MONTHS).indexOf(a.month).toString()
        ) -
        Object.keys(MONTHS).indexOf(
          Object.values(MONTHS).indexOf(b.month).toString()
        )
    );

    return result;
  }, [bills]);

  return (
    <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-6 w-full max-w-md">
      <h2 className="text-xl font-semibold text-gray-900">Daily Sales Overview</h2>
      <p className="text-sm text-gray-500 mb-4">
        Total sales & items sold (current year)
      </p>

      <div className="w-full h-64">
        {isLoading ? (
          <p className="text-center text-gray-400">Loading...</p>
        ) : chartData.length === 0 ? (
          <div className="flex justify-center items-center h-full text-gray-400 text-sm">
            No sales data found
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="month"
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
                labelStyle={{ color: "#1A73E8" }}
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
                yAxisId={1}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="text-xs text-gray-400 mt-4 text-center">
        Made with 💙 Akash Namkeen
      </div>
    </div>
  );
}

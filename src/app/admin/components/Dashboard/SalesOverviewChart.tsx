"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { month: "Feb", sales: 3000, units: 150 },
  { month: "Apr", sales: 4200, units: 200 },
  { month: "Jun", sales: 4800, units: 220 },
  { month: "Aug", sales: 5200, units: 240 },
  { month: "Oct", sales: 5600, units: 270 },
  { month: "Dec", sales: 6000, units: 300 },
];

export default function SalesOverviewChart() {
  return (
    <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-6 w-full max-w-md">
      <h2 className="text-xl font-semibold text-gray-900">Daily Sales Overview</h2>
      <p className="text-sm text-gray-500 mb-4">
        Sales and units sold over the last year.
      </p>

      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
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
              tickFormatter={(val) => `$${val}`}
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
              stroke="#3B0CA3"
              strokeWidth={3}
              dot={false}
              yAxisId={1}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="text-xs text-gray-400 mt-4 text-center">
        Made with 💙 Akash Namkeen
      </div>
    </div>
  );
}

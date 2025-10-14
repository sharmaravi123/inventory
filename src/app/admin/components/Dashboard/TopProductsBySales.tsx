"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { name: "Classic Bhujia", sales: 12000 },
  { name: "Masala Sev", sales: 9500 },
  { name: "Salted Chips", sales: 8000 },
  { name: "Moong Dal", sales: 6000 },
  { name: "Chana Jor Garam", sales: 4000 },
];

export default function TopProductsBySales() {
  return (
    <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-6 w-full max-w-md">
      <h2 className="text-xl font-semibold text-gray-900">Top 5 Products by Sales</h2>
      <p className="text-sm text-gray-500 mb-4">
        Performance of top products in the last month.
      </p>

      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <XAxis type="number" tick={{ fill: "#9CA3AF" }} />
            <YAxis dataKey="name" type="category" tick={{ fill: "#9CA3AF" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                borderRadius: "8px",
                border: "1px solid #E5E7EB",
              }}
            />
            <Bar dataKey="sales" fill="var(--color-error)" radius={8} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="text-xs text-gray-400 mt-4 text-center">
        Made with 💙 Akash Namkeen
      </div>
    </div>
  );
}

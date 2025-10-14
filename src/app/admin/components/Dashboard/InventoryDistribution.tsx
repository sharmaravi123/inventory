"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";

const data = [
  { name: "Snacks", value: 400 },
  { name: "Namkeen", value: 300 },
  { name: "Dry Fruits", value: 200 },
  { name: "Sweets", value: 100 },
  { name: "Beverages", value: 150 },
];

const COLORS = [
  "var(--color-primary)",
  "var(--color-success)",
  "var(--color-error)",
  "var(--color-warning)",
  "var(--color-secondary)",
];

export default function InventoryDistribution() {
  return (
    <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-6 w-full max-w-md">
      <h2 className="text-xl font-semibold text-gray-900">Inventory Distribution</h2>
      <p className="text-sm text-gray-500 mb-4">
        Breakdown of products by category.
      </p>

      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={4}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="text-xs text-gray-400 mt-4 text-center">
        Made with 💙 Akash Namkeen
      </div>
    </div>
  );
}

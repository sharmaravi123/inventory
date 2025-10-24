"use client";

import React from "react";

type Props = {
  totalInventory: number;
  lowStock: number;
  pendingOrders: number;
  recentReturns: number;
  loading?: boolean;
};

export default function DashboardStats({
  totalInventory,
  lowStock,
  pendingOrders,
  recentReturns,
  loading,
}: Props) {
  const stats = [
    { title: "Total Inventory", value: `${totalInventory} Units` },
    { title: "Low Stock Items", value: `${lowStock} Items` },
    { title: "Pending Orders", value: `${pendingOrders} Orders` },
    { title: "Recent Returns", value: `${recentReturns} Returns` },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <div
          key={i}
          className="bg-white rounded-lg border p-5 shadow-sm hover:shadow-md transition"
        >
          <h3 className="text-sm text-gray-500 mb-1">{s.title}</h3>
          <p className="text-2xl font-semibold text-[var(--color-sidebar)]">
            {loading ? "..." : s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

"use client";

import React from "react";

const products = [
  { name: "Namkeen Mix", category: "Snacks", stock: 5, updated: "2025-03-05" },
  { name: "Spicy Sev", category: "Snacks", stock: 8, updated: "2025-02-22" },
  { name: "Salted Peanuts", category: "Dry Fruits", stock: 12, updated: "2025-03-01" },
  { name: "Aloo Bhujia", category: "Snacks", stock: 3, updated: "2025-03-08" },
  { name: "Masala Chips", category: "Snacks", stock: 7, updated: "2025-03-03" },
];

export default function LowStockAlerts() {
  return (
    <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-6 w-full max-w-md">
      <h2 className="text-xl font-semibold text-gray-900">Low Stock Alerts</h2>
      <p className="text-sm text-gray-500 mb-4">
        Products requiring immediate restocking.
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-gray-700">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-2 text-left">Product</th>
              <th className="py-2 text-left">Category</th>
              <th className="py-2 text-left">Stock</th>
              <th className="py-2 text-left">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, idx) => (
              <tr key={idx} className="border-b last:border-0">
                <td className="py-2">{p.name}</td>
                <td className="py-2">{p.category}</td>
                <td className="py-2">
                  <span className="px-2 py-1 bg-[var(--color-error)] text-white rounded-full text-xs font-semibold">
                    {p.stock}
                  </span>
                </td>
                <td className="py-2 text-gray-500">{p.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-400 mt-4 text-center">
        Made with 💙 Akash Namkeen
      </div>
    </div>
  );
}

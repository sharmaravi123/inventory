"use client";

import React from "react";

const orders = [
  { id: "ORD001", customer: "Ravi Patel", status: "Delivered", amount: "$250.00" },
  { id: "ORD002", customer: "Sneha Sharma", status: "Shipped", amount: "$120.00" },
  { id: "ORD003", customer: "Amit Kumar", status: "Pending", amount: "$300.00" },
  { id: "ORD004", customer: "Nisha Mehta", status: "Delivered", amount: "$500.00" },
];

const statusColors: Record<string, string> = {
  Delivered: "bg-[var(--color-success)] text-white",
  Shipped: "bg-gray-100 text-gray-700",
  Pending: "bg-[var(--color-warning)] text-black",
};

export default function RecentOrders() {
  return (
    <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-6 w-full max-w-md">
      <h2 className="text-xl font-semibold text-gray-900">Recent Orders</h2>
      <p className="text-sm text-gray-500 mb-4">
        Latest orders received and their status.
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-gray-700">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-2 text-left">Order ID</th>
              <th className="py-2 text-left">Customer</th>
              <th className="py-2 text-left">Status</th>
              <th className="py-2 text-left">Amount</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, idx) => (
              <tr key={idx} className="border-b last:border-0">
                <td className="py-2">{o.id}</td>
                <td className="py-2">{o.customer}</td>
                <td className="py-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[o.status]}`}
                  >
                    {o.status}
                  </span>
                </td>
                <td className="py-2">{o.amount}</td>
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

"use client";

import React, { useMemo } from "react";
import { useListBillsQuery } from "@/store/billingApi";
import { useRouter } from "next/navigation";

const statusColors: Record<string, string> = {
  Paid: "bg-[var(--color-success)] text-white",
  "Partially Paid": "bg-[var(--color-warning)] text-black",
  Pending: "bg-gray-100 text-gray-700",
};

export default function RecentOrders() {
  const { data, isLoading } = useListBillsQuery({ search: "" });
  const bills = data?.bills ?? [];
  const router = useRouter();
  // Latest 5 sorted by created or billDate
  const recentOrders = useMemo(() => {
    return bills
      .slice()
      .sort(
        (a, b) =>
          new Date(b.billDate).getTime() - new Date(a.billDate).getTime()
      )
      .slice(0, 5)
      .map((bill) => {
        const paid = bill.amountCollected;
        const balance = bill.balanceAmount;

        let label: string;
        if (balance <= 0) label = "Paid";
        else if (bill.status === "PARTIALLY_PAID") label = "Partially Paid";
        else label = "Pending";

        return {
          invoice: bill.invoiceNumber,
          customer: bill.customerInfo.name,
          status: label,
          amount: bill.grandTotal.toFixed(2),
        };
      });
  }, [bills]);

  return (
    <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-6 w-full max-w-md">
      <h2 className="text-xl font-semibold text-gray-900">Recent Orders</h2>
      <p className="text-sm text-gray-500 mb-4">
        Latest customer orders and payments.
      </p>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : recentOrders.length === 0 ? (
        <p className="text-sm text-gray-500">No recent orders found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-gray-700">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-2 text-left">Invoice</th>
                <th className="py-2 text-left">Customer</th>
                <th className="py-2 text-left">Payment</th>
                <th className="py-2 text-left">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.invoice} className="border-b last:border-0">
                  <td className="py-2">{o.invoice}</td>
                  <td className="py-2">{o.customer}</td>
                  <td className="py-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[o.status]
                        }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="py-2">₹{o.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* VIEW ALL BUTTON */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                router.push("/admin/orders")
              }}
              className="rounded-full border border-[var(--color-primary)] px-3 py-1 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-white)] transition"
            >
              All Orders
              <span className="text-sm">→</span>
            </button>
          </div>

        </div>
      )}

      <div className="text-xs text-gray-400 mt-4 text-center">
        Made with 💙 JMK TRADERS
      </div>
    </div>
  );
}

// app/warehouse/components/Dashboard/WarehouseRecentOrders.tsx
"use client";

import React, { useMemo } from "react";
import { useListBillsQuery, type Bill } from "@/store/billingApi";

const statusColors: Record<string, string> = {
  Paid: "bg-[var(--color-success)] text-white",
  "Partially Paid": "bg-[var(--color-warning)] text-black",
  Pending: "bg-gray-100 text-gray-700",
};

type WarehouseRecentOrdersProps = {
  warehouseId?: string;
};

interface BillLineWarehouseRef {
  warehouseId?: string;
  warehouse?: unknown;
}

interface BillWithWarehouseLines extends Bill {
  items: (BillLineWarehouseRef & Bill["items"][number])[];
}

function extractId(ref: unknown): string | undefined {
  if (ref == null) return undefined;
  if (typeof ref === "string" || typeof ref === "number") return String(ref);
  if (typeof ref === "object") {
    const obj = ref as Record<string, unknown>;
    const candidate = obj._id ?? obj.id;
    if (candidate == null || candidate === "") return undefined;
    return String(candidate);
  }
  return undefined;
}

function filterBillsForWarehouse(
  bills: BillWithWarehouseLines[],
  warehouseId?: string
): BillWithWarehouseLines[] {
  if (!warehouseId) return [];
  return bills.filter((bill) =>
    bill.items.some((line) => {
      const wid = line.warehouseId ?? extractId(line.warehouse);
      if (!wid) return false;
      return String(wid) === String(warehouseId);
    })
  );
}

export default function WarehouseRecentOrders({
  warehouseId,
}: WarehouseRecentOrdersProps) {
  const { data, isLoading } = useListBillsQuery({
    search: "",
    warehouseId,
  });
  const bills = (data?.bills ?? []) as BillWithWarehouseLines[];

  const filteredBills = useMemo(
    () => filterBillsForWarehouse(bills, warehouseId),
    [bills, warehouseId]
  );

  const recentOrders = useMemo(() => {
    return filteredBills
      .slice()
      .sort(
        (a, b) =>
          new Date(b.billDate).getTime() - new Date(a.billDate).getTime()
      )
      .slice(0, 5)
      .map((bill) => {
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
  }, [filteredBills]);

  return (
    <div className="w-full">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
        Recent Orders – This Warehouse
      </h2>
      <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
        Latest customer orders for this warehouse.
      </p>

      {isLoading ? (
        <p className="text-xs sm:text-sm text-gray-500">Loading...</p>
      ) : recentOrders.length === 0 ? (
        <p className="text-xs sm:text-sm text-gray-500">
          No recent orders found for this warehouse.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[460px] text-xs sm:text-sm text-gray-700">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-2 pr-2 text-left">Invoice</th>
                <th className="py-2 pr-2 text-left">Customer</th>
                <th className="py-2 pr-2 text-left">Payment</th>
                <th className="py-2 text-left">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.invoice} className="border-b last:border-0">
                  <td className="py-2 pr-2 whitespace-nowrap">{o.invoice}</td>
                  <td className="py-2 pr-2">
                    <span className="line-clamp-1">{o.customer}</span>
                  </td>
                  <td className="py-2 pr-2">
                    <span
                      className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold ${
                        statusColors[o.status]
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="py-2 whitespace-nowrap">₹{o.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-[10px] sm:text-xs text-gray-400 mt-3 sm:mt-4 text-center">
        Made with 💙 Akash Namkeen – Warehouse
      </div>
    </div>
  );
}

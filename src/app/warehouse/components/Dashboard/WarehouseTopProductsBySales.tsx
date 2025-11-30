// app/warehouse/components/Dashboard/WarehouseTopProductsBySales.tsx
"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useListBillsQuery, type Bill } from "@/store/billingApi";

type ProductBarData = {
  name: string;
  sales: number;
};

type WarehouseTopProductsBySalesProps = {
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

export default function WarehouseTopProductsBySales({
  warehouseId,
}: WarehouseTopProductsBySalesProps) {
  const { data, isLoading } = useListBillsQuery({
    search: "",
    warehouseId,
  });
  const bills = (data?.bills ?? []) as BillWithWarehouseLines[];

  const filteredBills = useMemo(
    () => filterBillsForWarehouse(bills, warehouseId),
    [bills, warehouseId]
  );

  const chartData: ProductBarData[] = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const salesMap = new Map<string, number>();

    filteredBills.forEach((bill) => {
      const billDate = new Date(bill.billDate);
      const year = billDate.getFullYear();
      const month = billDate.getMonth();

      if (year !== currentYear || month !== currentMonth) return;

      bill.items.forEach((item) => {
        const typedItem = item as Bill["items"][number];
        const name = typedItem.productName || "Unknown Product";

        const baseAmount =
          typeof typedItem.lineTotal === "number"
            ? typedItem.lineTotal
            : typeof typedItem.sellingPrice === "number" &&
              typeof typedItem.totalItems === "number"
            ? typedItem.sellingPrice * typedItem.totalItems
            : 0;

        const prev = salesMap.get(name) ?? 0;
        salesMap.set(name, prev + baseAmount);
      });
    });

    const arr: ProductBarData[] = Array.from(salesMap.entries()).map(
      ([name, sales]) => ({
        name,
        sales,
      })
    );

    arr.sort((a, b) => b.sales - a.sales);

    return arr.slice(0, 5);
  }, [filteredBills]);

  return (
    <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-6 w-full max-w-md">
      <h2 className="text-xl font-semibold text-gray-900">
        Top 5 Products – This Warehouse
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Performance of top products this month for this warehouse.
      </p>

      <div className="w-full h-64">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Loading...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            No sales data found for this warehouse
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" tick={{ fill: "#9CA3AF" }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: "#9CA3AF" }}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                }}
                formatter={(value) => [
                  `₹${(value as number).toFixed(2)}`,
                  "Sales",
                ]}
              />
              <Bar
                dataKey="sales"
                fill="var(--color-error)"
                radius={8}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="text-xs text-gray-400 mt-4 text-center">
        Made with 💙 Akash Namkeen – Warehouse
      </div>
    </div>
  );
}

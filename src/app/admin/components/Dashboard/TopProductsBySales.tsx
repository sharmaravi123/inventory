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

export default function TopProductsBySales() {
  const { data, isLoading } = useListBillsQuery({ search: "" });
  const bills = data?.bills ?? [];

  const chartData: ProductBarData[] = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const salesMap = new Map<string, number>();

    bills.forEach((bill: Bill) => {
      const billDate = new Date(bill.billDate);
      const year = billDate.getFullYear();
      const month = billDate.getMonth();

      // Only count current month
      if (year !== currentYear || month !== currentMonth) return;

      bill.items.forEach((item) => {
        const name = item.productName || "Unknown Product";

        // Prefer lineTotal, fallback to sellingPrice * totalItems
        const baseAmount =
          typeof item.lineTotal === "number"
            ? item.lineTotal
            : typeof item.sellingPrice === "number" &&
              typeof item.totalItems === "number"
            ? item.sellingPrice * item.totalItems
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
  }, [bills]);

  return (
    <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-6 w-full max-w-md">
      <h2 className="text-xl font-semibold text-gray-900">
        Top 5 Products by Sales
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Performance of top products this month.
      </p>

      <div className="w-full h-64">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Loading...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            No sales data found
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
                formatter={(value) => [`₹${(value as number).toFixed(2)}`, "Sales"]}
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
        Made with 💙 Akash Namkeen
      </div>
    </div>
  );
}

// app/warehouse/components/Dashboard/WarehouseSalesOverviewChart.tsx
"use client";

import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useListBillsQuery, type Bill } from "@/store/billingApi";

type ChartRow = {
  month: string;
  sales: number;
  units: number;
};

const MONTHS: Record<number, string> = {
  0: "Jan",
  1: "Feb",
  2: "Mar",
  3: "Apr",
  4: "May",
  5: "Jun",
  6: "Jul",
  7: "Aug",
  8: "Sep",
  9: "Oct",
  10: "Nov",
  11: "Dec",
};

type WarehouseSalesOverviewChartProps = {
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

export default function WarehouseSalesOverviewChart({
  warehouseId,
}: WarehouseSalesOverviewChartProps) {
  const { data, isLoading } = useListBillsQuery({
    search: "",
    warehouseId,
  });
  const bills = (data?.bills ?? []) as BillWithWarehouseLines[];

  const filteredBills = useMemo(
    () => filterBillsForWarehouse(bills, warehouseId),
    [bills, warehouseId]
  );

  const chartData: ChartRow[] = useMemo(() => {
    const map = new Map<number, { sales: number; units: number }>();

    filteredBills.forEach((bill) => {
      const date = new Date(bill.billDate);
      const month = date.getMonth();

      const existing = map.get(month) ?? { sales: 0, units: 0 };

      existing.sales += bill.grandTotal;
      existing.units += bill.totalItems ?? 0;

      map.set(month, existing);
    });

    const result: ChartRow[] = [];
    map.forEach((v, k) => {
      result.push({
        month: MONTHS[k],
        sales: v.sales,
        units: v.units,
      });
    });

    result.sort((a, b) => {
      const monthIndexA = Object.values(MONTHS).indexOf(a.month);
      const monthIndexB = Object.values(MONTHS).indexOf(b.month);
      return monthIndexA - monthIndexB;
    });

    return result;
  }, [filteredBills]);

  return (
    <div className="w-full">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
        Warehouse Sales Overview
      </h2>
      <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
        Total sales & items sold for this warehouse (current year)
      </p>

      <div className="w-full h-56 sm:h-64">
        {isLoading ? (
          <p className="flex items-center justify-center h-full text-xs sm:text-sm text-gray-400">
            Loading...
          </p>
        ) : chartData.length === 0 ? (
          <div className="flex justify-center items-center h-full text-xs sm:text-sm text-gray-400">
            No sales data found for this warehouse
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="month"
                tick={{ fill: "#9CA3AF", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#9CA3AF", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
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
                stroke="var(--color-secondary)"
                strokeWidth={3}
                dot={false}
                yAxisId={1}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="text-[10px] sm:text-xs text-gray-400 mt-3 sm:mt-4 text-center">
        Made with 💙 Akash Namkeen – Warehouse
      </div>
    </div>
  );
}

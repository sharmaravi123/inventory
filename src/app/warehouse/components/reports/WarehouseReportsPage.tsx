// src/app/warehouse/components/reports/WarehouseReportsPage.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store/store";
import {
  BarChart3,
  Calendar,
  Package,
  Truck,
  Users,
  AlertTriangle,
  ShoppingCart,
  IndianRupee,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { fetchWarehouses } from "@/store/warehouseSlice";
import { fetchInventory } from "@/store/inventorySlice";
import { fetchProducts } from "@/store/productSlice";
import { fetchDrivers } from "@/store/driverSlice";
import { useListBillsQuery, Bill } from "@/store/billingApi";

type WarehouseReportsPageProps = {
  /**
   * If undefined => admin-like (no restriction).
   * If array => only those warehouseIds ka data show hoga.
   */
  allowedWarehouseIds?: string[];
};

function isWithinDateRange(dateStr: string, from: string, to: string): boolean {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;

  if (from) {
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    if (d < fromDate) return false;
  }

  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    if (d > toDate) return false;
  }

  return true;
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

export default function WarehouseReportsPage({
  allowedWarehouseIds,
}: WarehouseReportsPageProps) {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const { products } = useSelector((s: RootState) => s.product);
  const { list: warehouses } = useSelector((s: RootState) => s.warehouse);
  const { items: inventory } = useSelector((s: RootState) => s.inventory);
  const { items: drivers } = useSelector((s: RootState) => s.driver);

  const { data: billsData, isLoading: billsLoading, refetch } =
    useListBillsQuery({ search: "" });

  const bills: Bill[] = billsData?.bills ?? [];

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    dispatch(fetchProducts());
    dispatch(fetchWarehouses());
    dispatch(fetchInventory());
    dispatch(fetchDrivers());
  }, [dispatch]);

  const limitByWarehouse = !!allowedWarehouseIds && allowedWarehouseIds.length > 0;

  // bills limited to assigned warehouses
  const warehouseBills = useMemo(() => {
    if (!limitByWarehouse) return bills;

    return bills.filter((bill) =>
      bill.items.some((line) => {
        const rawLine = line as unknown as {
          warehouseId?: string;
          warehouse?: unknown;
        };
        const wid = rawLine.warehouseId ?? extractId(rawLine.warehouse);
        if (!wid) return false;
        return allowedWarehouseIds.includes(String(wid));
      })
    );
  }, [bills, allowedWarehouseIds, limitByWarehouse]);

  // date filter on top of warehouse filter
  const filteredBills = useMemo(() => {
    if (!fromDate && !toDate) return warehouseBills;
    return warehouseBills.filter((b) =>
      isWithinDateRange(b.billDate, fromDate, toDate)
    );
  }, [warehouseBills, fromDate, toDate]);

  // inventory limited to allowed warehouses
  const warehouseInventory = useMemo(() => {
    if (!limitByWarehouse) return inventory;
    return inventory.filter((item) => {
      const wid =
        extractId(
          (item as unknown as { warehouseId?: unknown; warehouse?: unknown })
            .warehouseId ??
            (item as unknown as { warehouse?: unknown }).warehouse
        ) ?? "";
      return allowedWarehouseIds.includes(wid);
    });
  }, [inventory, allowedWarehouseIds, limitByWarehouse]);

  // warehouses count for this user
  const warehouseCount = useMemo(() => {
    if (!limitByWarehouse) return warehouses.length;
    return warehouses.filter((w) => {
      const wid = String((w as { _id?: unknown; id?: unknown })._id ?? (w as { id?: unknown }).id ?? "");
      return wid !== "" && allowedWarehouseIds.includes(wid);
    }).length;
  }, [warehouses, allowedWarehouseIds, limitByWarehouse]);

  // ----- TOP LEVEL ORDER + PAYMENT METRICS -----
  const orderStats = useMemo(() => {
    let totalRevenue = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;

    let totalOrders = 0;
    let deliveredCount = 0;
    let partiallyPaidCount = 0;
    let pendingStatusCount = 0;

    let cashAmount = 0;
    let upiAmount = 0;
    let cardAmount = 0;

    filteredBills.forEach((bill) => {
      totalOrders += 1;
      totalRevenue += bill.grandTotal;
      totalCollected += bill.amountCollected;
      totalOutstanding += bill.balanceAmount;

      if (bill.status === "DELIVERED") deliveredCount += 1;
      else if (bill.status === "PARTIALLY_PAID") partiallyPaidCount += 1;
      else pendingStatusCount += 1;

      cashAmount += bill.payment.cashAmount ?? 0;
      upiAmount += bill.payment.upiAmount ?? 0;
      cardAmount += bill.payment.cardAmount ?? 0;
    });

    const avgOrderValue =
      totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalOrders,
      totalRevenue,
      totalCollected,
      totalOutstanding,
      deliveredCount,
      partiallyPaidCount,
      pendingStatusCount,
      avgOrderValue,
      cashAmount,
      upiAmount,
      cardAmount,
    };
  }, [filteredBills]);

  // ----- INVENTORY ALERTS (counts) -----
  const inventoryAlerts = useMemo(() => {
    if (!warehouseInventory.length) {
      return {
        lowStockCount: 0,
        outOfStockCount: 0,
      };
    }

    let lowStockCount = 0;
    let outOfStockCount = 0;

    warehouseInventory.forEach((item) => {
      const totalItems =
        item.boxes * item.itemsPerBox + item.looseItems;

      const lowStockTotal =
        (item.lowStockBoxes ?? 0) * item.itemsPerBox +
        (item.lowStockItems ?? 0);

      if (totalItems === 0) {
        outOfStockCount += 1;
      } else if (totalItems > 0 && totalItems <= lowStockTotal) {
        lowStockCount += 1;
      }
    });

    return { lowStockCount, outOfStockCount };
  }, [warehouseInventory]);

  // ----- DRIVER PERFORMANCE (only warehouse bills) -----
  const driverSummary = useMemo(() => {
    type DriverSummaryRow = {
      driverId: string;
      name: string;
      orders: number;
      delivered: number;
      collected: number;
      outstanding: number;
    };

    const summary: DriverSummaryRow[] = [];

    drivers.forEach((driver) => {
      const driverBills = filteredBills.filter(
        (b) => b.driver === driver._id
      );

      if (driverBills.length === 0) return;

      let orders = 0;
      let delivered = 0;
      let collected = 0;
      let outstanding = 0;

      driverBills.forEach((bill) => {
        orders += 1;
        collected += bill.amountCollected;
        outstanding += bill.balanceAmount;
        if (bill.status === "DELIVERED") delivered += 1;
      });

      summary.push({
        driverId: driver._id,
        name: driver.name,
        orders,
        delivered,
        collected,
        outstanding,
      });
    });

    summary.sort((a, b) => b.collected - a.collected);
    return summary.slice(0, 5);
  }, [drivers, filteredBills]);

  // ----- TOP CUSTOMERS (warehouse bills only) -----
  const topCustomers = useMemo(() => {
    type CustomerAgg = {
      name: string;
      phone: string;
      total: number;
      orders: number;
      outstanding: number;
    };

    const map = new Map<string, CustomerAgg>();

    filteredBills.forEach((bill) => {
      const key = bill.customerInfo.phone || bill.customerInfo.name;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          name: bill.customerInfo.name,
          phone: bill.customerInfo.phone,
          total: bill.grandTotal,
          orders: 1,
          outstanding: bill.balanceAmount,
        });
      } else {
        existing.total += bill.grandTotal;
        existing.orders += 1;
        existing.outstanding += bill.balanceAmount;
      }
    });

    const arr = Array.from(map.values());
    arr.sort((a, b) => b.total - a.total);
    return arr.slice(0, 5);
  }, [filteredBills]);

  const formatCurrency = (value: number): string =>
    `₹${value.toFixed(2)}`;

  const handleRefresh = (): void => {
    setFromDate("");
    setToDate("");
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[color:var(--color-sidebar)]">
            Warehouse Reports
          </h1>
          <p className="text-xs text-slate-500">
            Orders, payments, drivers and inventory – for your assigned warehouse(s).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-[color:var(--color-white)] px-2 py-1.5">
            <Calendar className="h-3.5 w-3.5 text-[color:var(--color-primary)]" />
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded border border-slate-200 px-2 py-1 text-[11px]"
              />
              <span className="text-slate-400">—</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded border border-slate-200 px-2 py-1 text-[11px]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-lg border border-slate-300 bg-[color:var(--color-white)] px-3 py-1.5 text-xs hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
          >
            Refresh & clear dates
          </button>
        </div>
      </div>

      {/* TOP SUMMARY CARDS */}
      <div className="grid gap-3 md:grid-cols-4">
        {/* ORDERS */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-[color:var(--color-white)] p-3 shadow-sm">
          <div>
            <p className="flex items-center gap-1 text-[11px] text-slate-500">
              <ShoppingCart className="h-3 w-3 text-[color:var(--color-primary)]" />
              Warehouse orders (filtered)
            </p>
            <p className="mt-1 text-2xl font-semibold text-[color:var(--color-sidebar)]">
              {orderStats.totalOrders}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Delivered: {orderStats.deliveredCount} • Partially paid:{" "}
              {orderStats.partiallyPaidCount}
            </p>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => router.push("/warehouse/billing")}
              className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2 py-0.5 text-[11px] hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
            >
              View all bills
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* REVENUE */}
        <div className="rounded-xl border border-slate-200 bg-[color:var(--color-white)] p-3 shadow-sm">
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            <BarChart3 className="h-3 w-3 text-[color:var(--color-primary)]" />
            Revenue
          </p>
          <p className="mt-1 text-lg font-semibold text-[color:var(--color-primary)]">
            {formatCurrency(orderStats.totalRevenue)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Avg bill: {formatCurrency(orderStats.avgOrderValue)}
          </p>
        </div>

        {/* COLLECTED */}
        <div className="rounded-xl border border-slate-200 bg-[color:var(--color-white)] p-3 shadow-sm">
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            <IndianRupee className="h-3 w-3 text-[color:var(--color-success)]" />
            Collected
          </p>
          <p className="mt-1 text-lg font-semibold text-[color:var(--color-success)]">
            {formatCurrency(orderStats.totalCollected)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Cash: {formatCurrency(orderStats.cashAmount)} • UPI:{" "}
            {formatCurrency(orderStats.upiAmount)} • Card:{" "}
            {formatCurrency(orderStats.cardAmount)}
          </p>
        </div>

        {/* OUTSTANDING */}
        <div className="rounded-xl border border-slate-200 bg-[color:var(--color-white)] p-3 shadow-sm">
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            <IndianRupee className="h-3 w-3 text-[color:var(--color-error)]" />
            Outstanding dues
          </p>
          <p className="mt-1 text-lg font-semibold text-[color:var(--color-error)]">
            {formatCurrency(orderStats.totalOutstanding)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Pending status bills: {orderStats.pendingStatusCount}
          </p>
        </div>
      </div>

      {/* RESOURCES OVERVIEW */}
      <div className="grid gap-3 md:grid-cols-3">
        {/* PRODUCTS + WAREHOUSE */}
        <div className="rounded-xl border border-slate-200 bg-[color:var(--color-white)] p-4 shadow-sm">
          <p className="flex items-center gap-1 text-xs font-semibold text-[color:var(--color-sidebar)]">
            <Package className="h-4 w-4 text-[color:var(--color-primary)]" />
            Products & Warehouses
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] text-slate-500">Products</p>
              <p className="text-xl font-semibold text-[color:var(--color-sidebar)]">
                {products.length}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Warehouses</p>
              <p className="text-xl font-semibold text-[color:var(--color-sidebar)]">
                {warehouseCount}
              </p>
            </div>
          </div>
        </div>

        {/* INVENTORY ALERT COUNTS */}
        <div className="rounded-xl border border-slate-200 bg-[color:var(--color-white)] p-4 shadow-sm">
          <p className="flex items-center gap-1 text-xs font-semibold text-[color:var(--color-sidebar)]">
            <AlertTriangle className="h-4 w-4 text-[color:var(--color-warning)]" />
            Inventory alerts
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] text-slate-500">Low stock</p>
              <p className="text-xl font-semibold text-[color:var(--color-warning)]">
                {inventoryAlerts.lowStockCount}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Out of stock</p>
              <p className="text-xl font-semibold text-[color:var(--color-error)]">
                {inventoryAlerts.outOfStockCount}
              </p>
            </div>
          </div>
        </div>

        {/* DRIVERS SUMMARY */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-[color:var(--color-white)] p-4 shadow-sm">
          <div>
            <p className="flex items-center gap-1 text-xs font-semibold text-[color:var(--color-sidebar)]">
              <Truck className="h-4 w-4 text-[color:var(--color-primary)]" />
              Drivers
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] text-slate-500">Total drivers</p>
                <p className="text-xl font-semibold text-[color:var(--color-sidebar)]">
                  {drivers.length}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">
                  Active (has bills)
                </p>
                <p className="text-xl font-semibold text-[color:var(--color-success)]">
                  {driverSummary.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DRIVER + CUSTOMERS SECTION */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* DRIVER PERFORMANCE TABLE */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-[color:var(--color-white)] p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1 text-xs font-semibold text-[color:var(--color-sidebar)]">
              <Truck className="h-4 w-4 text-[color:var(--color-primary)]" />
              Top drivers (by collection)
            </p>
          </div>

          {driverSummary.length === 0 && (
            <p className="text-xs text-slate-500">
              No driver billing data in selected range.
            </p>
          )}

          {driverSummary.length > 0 && (
            <div className="max-h-60 overflow-y-auto">
              <table className="min-w-full border-collapse text-[11px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border-b px-2 py-1 text-left">Driver</th>
                    <th className="border-b px-2 py-1 text-right">Bills</th>
                    <th className="border-b px-2 py-1 text-right">
                      Delivered
                    </th>
                    <th className="border-b px-2 py-1 text-right">
                      Collected
                    </th>
                    <th className="border-b px-2 py-1 text-right">
                      Outstanding
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {driverSummary.map((d) => (
                    <tr key={d.driverId}>
                      <td className="border-b px-2 py-1 text-left">
                        {d.name}
                      </td>
                      <td className="border-b px-2 py-1 text-right">
                        {d.orders}
                      </td>
                      <td className="border-b px-2 py-1 text-right">
                        {d.delivered}
                      </td>
                      <td className="border-b px-2 py-1 text-right">
                        {formatCurrency(d.collected)}
                      </td>
                      <td className="border-b px-2 py-1 text-right">
                        {formatCurrency(d.outstanding)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TOP CUSTOMERS */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-[color:var(--color-white)] p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1 text-xs font-semibold text-[color:var(--color-sidebar)]">
              <Users className="h-4 w-4 text-[color:var(--color-primary)]" />
              Top customers (by billing)
            </p>
          </div>

          {topCustomers.length === 0 && (
            <p className="text-xs text-slate-500">
              No customer data in selected range.
            </p>
          )}

          {topCustomers.length > 0 && (
            <div className="max-h-60 overflow-y-auto">
              <table className="min-w-full border-collapse text-[11px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border-b px-2 py-1 text-left">Customer</th>
                    <th className="border-b px-2 py-1 text-right">Bills</th>
                    <th className="border-b px-2 py-1 text-right">Total</th>
                    <th className="border-b px-2 py-1 text-right">
                      Outstanding
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((c, idx) => (
                    <tr key={`${c.phone}-${idx}`}>
                      <td className="border-b px-2 py-1 text-left">
                        <div className="flex flex-col">
                          <span>{c.name}</span>
                          <span className="text-[10px] text-slate-500">
                            {c.phone}
                          </span>
                        </div>
                      </td>
                      <td className="border-b px-2 py-1 text-right">
                        {c.orders}
                      </td>
                      <td className="border-b px-2 py-1 text-right">
                        {formatCurrency(c.total)}
                      </td>
                      <td className="border-b px-2 py-1 text-right">
                        {formatCurrency(c.outstanding)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Top 5 customers for your warehouse(s).</span>
            <button
              type="button"
              onClick={() => router.push("/warehouse/billing")}
              className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2 py-0.5 hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
            >
              View all bills
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {billsLoading && (
        <p className="text-[11px] text-slate-500">
          Loading billing data...
        </p>
      )}
    </div>
  );
}

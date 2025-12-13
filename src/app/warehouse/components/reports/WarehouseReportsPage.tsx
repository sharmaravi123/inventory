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
  allowedWarehouseIds?: string[];
};

function isWithinDateRange(dateStr: string, from: string, to: string): boolean {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;

  if (from) {
    const f = new Date(from);
    f.setHours(0, 0, 0, 0);
    if (d < f) return false;
  }

  if (to) {
    const t = new Date(to);
    t.setHours(23, 59, 59, 999);
    if (d > t) return false;
  }

  return true;
}

function extractId(ref: unknown): string | undefined {
  if (!ref) return undefined;
  if (typeof ref === "string" || typeof ref === "number") return String(ref);

  const obj = ref as Record<string, unknown>;
  const id = obj._id ?? obj.id;
  return id ? String(id) : undefined;
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

  const restricted = !!allowedWarehouseIds && allowedWarehouseIds.length > 0;

  // Bills only for allowed warehouses
  const warehouseBills = useMemo(() => {
    if (!restricted) return bills;

    return bills.filter((bill) =>
      bill.items.some((line) => {
        const raw = line as unknown as { warehouseId?: string; warehouse?: unknown };
        const wid = raw.warehouseId ?? extractId(raw.warehouse);
        return wid ? allowedWarehouseIds.includes(wid) : false;
      })
    );
  }, [bills, allowedWarehouseIds, restricted]);

  const filteredBills = useMemo(() => {
    if (!fromDate && !toDate) return warehouseBills;

    return warehouseBills.filter((b) =>
      isWithinDateRange(b.billDate, fromDate, toDate)
    );
  }, [warehouseBills, fromDate, toDate]);

  // Inventory filter
  const warehouseInventory = useMemo(() => {
    if (!restricted) return inventory;

    return inventory.filter((item) => {
      const wid = extractId(item.warehouseId ?? item.warehouse) ?? "";
      return allowedWarehouseIds.includes(wid);
    });
  }, [inventory, restricted, allowedWarehouseIds]);

  const warehouseCount = useMemo(() => {
    if (!restricted) return warehouses.length;

    return warehouses.filter((w) => {
      const wid = String(w._id ?? w.id ?? "");
      return allowedWarehouseIds.includes(wid);
    }).length;
  }, [warehouses, restricted, allowedWarehouseIds]);

  // Summary
  const orderStats = useMemo(() => {
    let totalRevenue = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;

    let totalOrders = 0;
    let delivered = 0;
    let partPaid = 0;
    let pending = 0;

    let cash = 0;
    let upi = 0;
    let card = 0;

    filteredBills.forEach((bill) => {
      totalOrders += 1;
      totalRevenue += bill.grandTotal;
      totalCollected += bill.amountCollected;
      totalOutstanding += bill.balanceAmount;

      if (bill.status === "DELIVERED") delivered++;
      else if (bill.status === "PARTIALLY_PAID") partPaid++;
      else pending++;

      cash += bill.payment.cashAmount ?? 0;
      upi += bill.payment.upiAmount ?? 0;
      card += bill.payment.cardAmount ?? 0;
    });

    return {
      totalOrders,
      totalRevenue,
      totalCollected,
      totalOutstanding,
      delivered,
      partPaid,
      pending,
      avgOrderValue: totalOrders ? totalRevenue / totalOrders : 0,
      cash,
      upi,
      card,
    };
  }, [filteredBills]);

  // Inventory alerts (correct perBoxItem usage)
  const inventoryAlerts = useMemo(() => {
    let low = 0;
    let out = 0;

    warehouseInventory.forEach((item) => {
      const itemsPerBox = item.product?.perBoxItem ?? 1;

      const totalItems =
        item.boxes * itemsPerBox + item.looseItems;

      const lowLimit =
        (item.lowStockBoxes ?? 0) * itemsPerBox +
        (item.lowStockItems ?? 0);

      if (totalItems === 0) out++;
      else if (totalItems > 0 && totalItems <= lowLimit) low++;
    });

    return { low, out };
  }, [warehouseInventory]);

  // Driver summary
  const driverSummary = useMemo(() => {
    const rows: {
      driverId: string;
      name: string;
      orders: number;
      delivered: number;
      collected: number;
      outstanding: number;
    }[] = [];

    drivers.forEach((dr) => {
      const billsForDriver = filteredBills.filter(
        (b) => b.driver === dr._id
      );

      if (!billsForDriver.length) return;

      let orders = 0;
      let dcount = 0;
      let collected = 0;
      let out = 0;

      billsForDriver.forEach((b) => {
        orders++;
        collected += b.amountCollected;
        out += b.balanceAmount;
        if (b.status === "DELIVERED") dcount++;
      });

      rows.push({
        driverId: dr._id,
        name: dr.name,
        orders,
        delivered: dcount,
        collected,
        outstanding: out,
      });
    });

    rows.sort((a, b) => b.collected - a.collected);
    return rows.slice(0, 5);
  }, [drivers, filteredBills]);

  // Customers
  const topCustomers = useMemo(() => {
    const map = new Map<
      string,
      { name: string; phone: string; total: number; orders: number; outstanding: number }
    >();

    filteredBills.forEach((bill) => {
      const key = bill.customerInfo.phone || bill.customerInfo.name;
      const row = map.get(key);

      if (!row) {
        map.set(key, {
          name: bill.customerInfo.name,
          phone: bill.customerInfo.phone,
          total: bill.grandTotal,
          orders: 1,
          outstanding: bill.balanceAmount,
        });
      } else {
        row.total += bill.grandTotal;
        row.orders++;
        row.outstanding += bill.balanceAmount;
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredBills]);

  const format = (n: number) => `₹${n.toFixed(2)}`;

  const handleRefresh = () => {
    setFromDate("");
    setToDate("");
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[color:var(--color-sidebar)]">
            Warehouse Reports
          </h1>
          <p className="text-xs text-slate-500">
            Orders, payments, drivers, and inventory for your warehouse(s)
          </p>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5">
            <Calendar className="h-3.5 w-3.5 text-[color:var(--color-primary)]" />
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

          <button
            onClick={handleRefresh}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs hover:text-[color:var(--color-primary)] hover:border-[color:var(--color-primary)]"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            <ShoppingCart className="h-3 w-3 text-[color:var(--color-primary)]" />
            Bills
          </p>
          <p className="text-2xl font-semibold mt-1">
            {orderStats.totalOrders}
          </p>
          <p className="text-[11px] text-slate-500">
            Delivered: {orderStats.delivered} • PartPaid: {orderStats.partPaid}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            <BarChart3 className="h-3 w-3 text-[color:var(--color-primary)]" />
            Revenue
          </p>
          <p className="text-lg font-semibold mt-1 text-[color:var(--color-primary)]">
            {format(orderStats.totalRevenue)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            <IndianRupee className="h-3 w-3 text-[color:var(--color-success)]" />
            Collected
          </p>
          <p className="text-lg font-semibold mt-1 text-[color:var(--color-success)]">
            {format(orderStats.totalCollected)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            <IndianRupee className="h-3 w-3 text-[color:var(--color-error)]" />
            Outstanding
          </p>
          <p className="text-lg font-semibold mt-1 text-[color:var(--color-error)]">
            {format(orderStats.totalOutstanding)}
          </p>
        </div>
      </div>

      {/* Resources */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold flex items-center gap-1">
            <Package className="h-4 w-4" />
            Products & Warehouses
          </p>
          <div className="mt-3 grid grid-cols-2">
            <div>
              <p className="text-[11px]">Products</p>
              <p className="text-xl font-semibold">{products.length}</p>
            </div>
            <div>
              <p className="text-[11px]">Warehouses</p>
              <p className="text-xl font-semibold">{warehouseCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold flex items-center gap-1">
            <AlertTriangle className="h-4 w-4 text-[color:var(--color-warning)]" />
            Inventory Alerts
          </p>

          <div className="mt-3 grid grid-cols-2">
            <div>
              <p className="text-[11px]">Low Stock</p>
              <p className="text-xl font-semibold text-[color:var(--color-warning)]">
                {inventoryAlerts.low}
              </p>
            </div>
            <div>
              <p className="text-[11px]">Out of Stock</p>
              <p className="text-xl font-semibold text-[color:var(--color-error)]">
                {inventoryAlerts.out}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold flex items-center gap-1">
            <Truck className="h-4 w-4" />
            Drivers
          </p>
          <p className="text-xl mt-3 font-semibold">{drivers.length}</p>
        </div>
      </div>

      {/* Tables */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Drivers */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold flex items-center gap-1 mb-2">
            <Truck className="h-4 w-4" /> Top Drivers
          </p>

          {driverSummary.length === 0 ? (
            <p className="text-xs text-slate-500">No driver data.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              <table className="min-w-full border-collapse text-[11px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border-b px-2 py-1 text-left">Driver</th>
                    <th className="border-b px-2 py-1 text-right">Bills</th>
                    <th className="border-b px-2 py-1 text-right">Collected</th>
                    <th className="border-b px-2 py-1 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {driverSummary.map((d) => (
                    <tr key={d.driverId}>
                      <td className="border-b px-2 py-1">{d.name}</td>
                      <td className="border-b px-2 py-1 text-right">{d.orders}</td>
                      <td className="border-b px-2 py-1 text-right">{format(d.collected)}</td>
                      <td className="border-b px-2 py-1 text-right">{format(d.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Customers */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold flex items-center gap-1 mb-2">
            <Users className="h-4 w-4" /> Top Customers
          </p>

          {topCustomers.length === 0 ? (
            <p className="text-xs text-slate-500">No customer data.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              <table className="min-w-full border-collapse text-[11px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border-b px-2 py-1">Customer</th>
                    <th className="border-b px-2 py-1 text-right">Bills</th>
                    <th className="border-b px-2 py-1 text-right">Total</th>
                    <th className="border-b px-2 py-1 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((c, i) => (
                    <tr key={`${c.phone}-${i}`}>
                      <td className="border-b px-2 py-1">
                        <div className="flex flex-col">
                          {c.name}
                          <span className="text-[10px] text-slate-500">
                            {c.phone}
                          </span>
                        </div>
                      </td>
                      <td className="border-b px-2 py-1 text-right">{c.orders}</td>
                      <td className="border-b px-2 py-1 text-right">{format(c.total)}</td>
                      <td className="border-b px-2 py-1 text-right">{format(c.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {billsLoading && (
        <p className="text-xs text-slate-500">Loading bills...</p>
      )}
    </div>
  );
}

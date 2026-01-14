"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
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

type ReturnRecord = {
  _id: string;
  invoiceNumber?: string;
  customerInfo: {
    name: string;
    phone: string;
    shopName?: string;
  };
  items: {
    productName: string;
    totalItems: number;
    unitPrice?: number;
    lineAmount?: number;
  }[];
  totalAmount?: number;
  createdAt: string;
};

type Product = {
  _id?: string;
  id?: string;
  perBoxItem?: number;
  purchasePrice?: number;
  sellingPrice?: number;
  price?: number;
};

// Fixed InventoryItem to match store types exactly
type InventoryItem = {
  _id?: string;
  id?: string;
  productId?: unknown;
  product?: unknown;
  boxes?: number | string;
  looseItems?: number | string;
  lowStockBoxes?: number | string | null;
  lowStockItems?: number | string | null;
};

type BillItem = {
  quantityBoxes?: number;
  itemsPerBox?: number;
  quantityLoose?: number;
  quantity?: number;
  sellingPrice?: number;
  taxPercent?: number;
};

const extractId = (ref: unknown): string | undefined => {
  if (ref == null) return undefined;
  if (typeof ref === "string" || typeof ref === "number") return String(ref);
  if (typeof ref === "object") {
    const obj = ref as Record<string, unknown>;
    const id = obj._id ?? obj.id;
    if (!id) return undefined;
    return String(id);
  }
  return undefined;
};

const getProductPerBox = (inv: InventoryItem, products: Product[]): number => {
  const pid = extractId(inv.productId ?? inv.product);
  if (!pid) return 1;
  const p = products.find((x) => String(x._id ?? x.id) === pid);
  const perBox = typeof p?.perBoxItem === "number" ? p.perBoxItem : 1;
  return perBox > 0 ? perBox : 1;
};

const getProductPrices = (
  productId: string | undefined,
  products: Product[]
): { purchase?: number; selling?: number } => {
  if (!productId) return {};
  const p = products.find(
    (x) => String(x._id ?? x.id) === String(productId)
  );
  if (!p) return {};
  return {
    purchase: p.purchasePrice ?? p.price,
    selling: p.sellingPrice ?? p.price,
  };
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

export default function ReportsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const { products } = useSelector((s: RootState) => s.product);
  const { list: warehouses } = useSelector((s: RootState) => s.warehouse);
  const { items: inventory } = useSelector((s: RootState) => s.inventory);
  const { items: drivers } = useSelector((s: RootState) => s.driver);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);

  useEffect(() => {
    fetch("/api/returns")
      .then((r) => r.json())
      .then((d) => setReturns(d.returns ?? []))
      .catch(() => {});
  }, []);

  const computeReturnAmount = (r: ReturnRecord): number => {
    if (typeof r.totalAmount === "number") return r.totalAmount;

    return r.items.reduce((sum, item) => {
      if (typeof item.lineAmount === "number") {
        return sum + item.lineAmount;
      }
      if (typeof item.unitPrice === "number") {
        return sum + item.unitPrice * item.totalItems;
      }
      return sum;
    }, 0);
  };

  const { data: billsData, isLoading: billsLoading, refetch } =
    useListBillsQuery({
      search: "",
    });

  const bills = useMemo(() => billsData?.bills ?? [], [billsData]);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    dispatch(fetchProducts());
    dispatch(fetchWarehouses());
    dispatch(fetchInventory());
    dispatch(fetchDrivers());
  }, [dispatch]);

  // ----- FILTERED BILLS BY DATE -----
  const filteredBills = useMemo(() => {
    if (!fromDate && !toDate) return bills;
    return bills.filter((b) => isWithinDateRange(b.billDate, fromDate, toDate));
  }, [bills, fromDate, toDate]);

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

  // ----- INVENTORY ALERTS (only counts, sample section removed) -----
  const inventoryAlerts = useMemo(() => {
    if (!inventory.length || !products.length) {
      return { lowStockCount: 0, outOfStockCount: 0 };
    }

    let lowStockCount = 0;
    let outOfStockCount = 0;

    const getItemsPerBox = (productId?: string): number => {
      if (!productId) return 1;

      const p = products.find(
        (prod) => String(prod._id ?? prod.id) === String(productId)
      );

      return p?.perBoxItem ?? 1;
    };

    inventory.forEach((item) => {
      const perBox = getItemsPerBox(extractId(item.productId ?? item.product));

      const boxes = Number(item.boxes ?? 0);
      const loose = Number(item.looseItems ?? 0);

      const totalItems = boxes * perBox + loose;

      // sensible default: 1 box = low stock if not defined
      const lowStockThreshold =
        (Number(item.lowStockBoxes ?? 1) * perBox) +
        Number(item.lowStockItems ?? 0);

      if (totalItems === 0) {
        outOfStockCount += 1;
      } else if (totalItems <= lowStockThreshold) {
        lowStockCount += 1;
      }
    });

    return { lowStockCount, outOfStockCount };
  }, [inventory, products]);

  const returnStats = useMemo(() => {
    let totalReturned = 0;

    returns.forEach((r) => {
      const d = new Date(r.createdAt);

      if (fromDate) {
        const f = new Date(fromDate);
        f.setHours(0, 0, 0, 0);
        if (d < f) return;
      }

      if (toDate) {
        const t = new Date(toDate);
        t.setHours(23, 59, 59, 999);
        if (d > t) return;
      }

      totalReturned += computeReturnAmount(r);
    });

    return {
      totalReturned,
    };
  }, [returns, fromDate, toDate]);

  // ----- DRIVER PERFORMANCE -----
  const driverSummary = useMemo(() => {
    const summary: {
      driverId: string;
      name: string;
      orders: number;
      delivered: number;
      collected: number;
      outstanding: number;
    }[] = [];

    drivers.forEach((d) => {
      const driverBills = filteredBills.filter((b) => b.driver === d._id);

      if (driverBills.length === 0) return;

      let orders = 0;
      let delivered = 0;
      let collected = 0;
      let outstanding = 0;

      driverBills.forEach((b) => {
        orders += 1;
        collected += b.amountCollected;
        outstanding += b.balanceAmount;
        if (b.status === "DELIVERED") delivered += 1;
      });

      summary.push({
        driverId: d._id,
        name: d.name,
        orders,
        delivered,
        collected,
        outstanding,
      });
    });

    summary.sort((a, b) => b.collected - a.collected);
    return summary.slice(0, 5);
  }, [drivers, filteredBills]);

  // ----- TOP CUSTOMERS (top 5) -----
  const topCustomers = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        phone: string;
        total: number;
        orders: number;
        outstanding: number;
      }
    >();

    filteredBills.forEach((b) => {
      const key = b.customerInfo.phone || b.customerInfo.name;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          name: b.customerInfo.name,
          phone: b.customerInfo.phone,
          total: b.grandTotal,
          orders: 1,
          outstanding: b.balanceAmount,
        });
      } else {
        existing.total += b.grandTotal;
        existing.orders += 1;
        existing.outstanding += b.balanceAmount;
      }
    });

    const arr = Array.from(map.values());
    arr.sort((a, b) => b.total - a.total);
    return arr.slice(0, 5);
  }, [filteredBills]);

  const formatCurrency = (value: number): string =>
    `₹${value.toFixed(2)}`;

  const handleRefresh = useCallback((): void => {
    // Refresh + date reset as you asked
    setFromDate("");
    setToDate("");
    refetch();
  }, [refetch]);

  const gstReport = useMemo(() => {
    let totalGST = 0;

    filteredBills.forEach((bill) => {
      bill.items.forEach((item: BillItem) => {
        const qty =
          (item.quantityBoxes ?? 0) * (item.itemsPerBox ?? 1) +
          (item.quantityLoose ?? item.quantity ?? 0);

        const price = item.sellingPrice ?? 0;
        const taxPercent = item.taxPercent ?? 0;

        const taxableAmount = qty * price;
        const gstAmount = (taxableAmount * taxPercent) / 100;

        totalGST += gstAmount;
      });
    });

    return {
      totalGST,
      cgst: totalGST / 2,
      sgst: totalGST / 2,
    };
  }, [filteredBills]);

  const reportInventoryTotals = useMemo(() => {
    let totalItems = 0;
    let totalPurchaseValue = 0;
    let totalSellingValue = 0;

    inventory.forEach((inv: InventoryItem) => {
      const perBox = getProductPerBox(inv, products as Product[]);
      const qty = Number(inv.boxes ?? 0) * perBox + Number(inv.looseItems ?? 0);

      const pid = extractId(inv.productId ?? inv.product);
      const prices = getProductPrices(pid, products as Product[]);

      totalItems += qty;
      totalPurchaseValue += prices.purchase
        ? qty * prices.purchase
        : 0;
      totalSellingValue += prices.selling
        ? qty * prices.selling
        : 0;
    });

    return {
      totalItems,
      totalPurchaseValue,
      totalSellingValue,
    };
  }, [inventory, products]);

  const recentReturns = useMemo(() => {
    return returns
      .filter((r) => {
        const d = new Date(r.createdAt);

        if (fromDate) {
          const f = new Date(fromDate);
          f.setHours(0, 0, 0, 0);
          if (d < f) return false;
        }

        if (toDate) {
          const t = new Date(toDate);
          t.setHours(23, 59, 59, 999);
          if (d > t) return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      )
      .slice(0, 5);
  }, [returns, fromDate, toDate]);

  const monthWiseBills = useMemo(() => {
    const map = new Map<string, { bills: number; amount: number }>();

    filteredBills.forEach((b) => {
      const d = new Date(b.billDate);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;

      if (!map.has(key)) {
        map.set(key, { bills: 0, amount: 0 });
      }

      const m = map.get(key)!;
      m.bills += 1;
      m.amount += b.grandTotal;
    });

    return Array.from(map.entries());
  }, [filteredBills]);

  return (
    <div className="space-y-6 min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Reports & Analytics
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Consolidated overview of orders, payments, drivers & inventory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <Calendar className="h-4 w-4 text-[color:var(--color-primary)]" />
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  From
                </span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-[color:var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
                />
              </div>
              <span className="text-slate-400">—</span>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  To
                </span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-[color:var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-700 shadow-sm hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
          >
            Refresh & clear dates
          </button>
        </div>
      </div>

      {/* TOP SUMMARY CARDS */}
      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-5">
        {/* ORDERS */}
        <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 flex items-center gap-1">
              <ShoppingCart className="h-3.5 w-3.5 text-[color:var(--color-primary)]" />
              Orders (filtered)
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {orderStats.totalOrders}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Delivered:{" "}
              <span className="font-semibold text-emerald-600">
                {orderStats.deliveredCount}
              </span>{" "}
              • Partially paid:{" "}
              <span className="font-semibold text-amber-600">
                {orderStats.partiallyPaidCount}
              </span>
            </p>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => router.push("/admin/orders")}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
            >
              View all orders
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* REVENUE */}
        <div className="group rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm transition hover:shadow-md">
          <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 flex items-center gap-1">
            <BarChart3 className="h-3.5 w-3.5 text-emerald-500" />
            Revenue
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">
            {formatCurrency(orderStats.totalRevenue)}
          </p>
          <p className="mt-1 text-[11px] text-emerald-700/80">
            Avg order:{" "}
            <span className="font-semibold">
              {formatCurrency(orderStats.avgOrderValue)}
            </span>
          </p>
        </div>

        {/* COLLECTED */}
        <div className="group rounded-2xl border border-sky-100 bg-sky-50 p-4 shadow-sm transition hover:shadow-md">
          <p className="text-[11px] font-medium uppercase tracking-wide text-sky-700 flex items-center gap-1">
            <IndianRupee className="h-3.5 w-3.5 text-emerald-500" />
            Collected
          </p>
          <p className="mt-2 text-2xl font-semibold text-sky-800">
            {formatCurrency(orderStats.totalCollected)}
          </p>
          <p className="mt-1 text-[11px] text-sky-800/80">
            Cash:{" "}
            <span className="font-semibold">
              {formatCurrency(orderStats.cashAmount)}
            </span>{" "}
            • UPI:{" "}
            <span className="font-semibold">
              {formatCurrency(orderStats.upiAmount)}
            </span>{" "}
            • Card:{" "}
            <span className="font-semibold">
              {formatCurrency(orderStats.cardAmount)}
            </span>
          </p>
        </div>

        {/* OUTSTANDING */}
        <div className="group rounded-2xl border border-rose-100 bg-rose-50 p-4 shadow-sm transition hover:shadow-md">
          <p className="text-[11px] font-medium uppercase tracking-wide text-rose-700 flex items-center gap-1">
            <IndianRupee className="h-3.5 w-3.5 text-rose-500" />
            Outstanding dues
          </p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">
            {formatCurrency(orderStats.totalOutstanding)}
          </p>
          <p className="mt-1 text-[11px] text-rose-700/80">
            Pending orders:{" "}
            <span className="font-semibold">
              {orderStats.pendingStatusCount}
            </span>
          </p>
        </div>

        {/* RETURNED */}
        <div className="group rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm transition hover:shadow-md">
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 flex items-center gap-1">
            <IndianRupee className="h-3.5 w-3.5 text-amber-500" />
            Returned amount
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">
            {formatCurrency(returnStats.totalReturned)}
          </p>
          <p className="mt-1 text-[11px] text-amber-700/80">
            Amount already returned to customers
          </p>
        </div>
      </div>

      {/* RESOURCES OVERVIEW */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* PRODUCTS + WAREHOUSE */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-900 flex items-center gap-2">
            <Package className="h-4 w-4 text-[color:var(--color-primary)]" />
            Products & Warehouses
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[11px] text-slate-500">Products</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {products.length}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Warehouses</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {warehouses.length}
              </p>
            </div>
          </div>
        </div>

        {/* INVENTORY ALERT COUNTS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Inventory alerts
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[11px] text-slate-500">Low stock</p>
              <p className="mt-1 text-2xl font-semibold text-amber-600">
                {inventoryAlerts.lowStockCount}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Out of stock</p>
              <p className="mt-1 text-2xl font-semibold text-rose-600">
                {inventoryAlerts.outOfStockCount}
              </p>
            </div>
          </div>
        </div>

        {/* DRIVERS SUMMARY */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-900 flex items-center gap-2">
              <Truck className="h-4 w-4 text-[color:var(--color-primary)]" />
              Drivers
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[11px] text-slate-500">Total drivers</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {drivers.length}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Active (has orders)</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-600">
                  {driverSummary.length}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => router.push("/admin/driver")}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
            >
              View all drivers
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* GST SUMMARY */}
        {/* <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] text-slate-500">Total GST</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {formatCurrency(gstReport.totalGST)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] text-slate-500">CGST</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {formatCurrency(gstReport.cgst)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] text-slate-500">SGST</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {formatCurrency(gstReport.sgst)}
            </p>
          </div>
        </div> */}

        {/* INVENTORY REPORT */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] text-slate-500">Total items available</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {reportInventoryTotals.totalItems}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] text-slate-500">Total purchase value</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              ₹{reportInventoryTotals.totalPurchaseValue.toFixed(2)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] text-slate-500">Total selling value</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              ₹{reportInventoryTotals.totalSellingValue.toFixed(2)}
            </p>
          </div>
        </div>

        {/* RECENT RETURNS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Recent returns</p>
            <button
              onClick={() => router.push("/admin/returns")}
              className="text-xs border border-slate-200 bg-slate-50 px-2 py-0.5 rounded-full text-slate-700 hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
            >
              View all
            </button>
          </div>

          {recentReturns.length === 0 ? (
            <p className="text-xs text-slate-500">No returns</p>
          ) : (
            <div className="max-h-56 overflow-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-slate-500">
                    <th className="py-1.5">Customer</th>
                    <th className="py-1.5">Product</th>
                    <th className="py-1.5 text-right">Qty</th>
                    <th className="py-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReturns.map((r) =>
                    r.items.map((it, idx) => (
                      <tr
                        key={`${r._id}-${idx}`}
                        className="border-t border-slate-100 text-slate-700"
                      >
                        <td className="py-2 align-top">
                          {r.customerInfo.name}
                          <div className="text-[10px] text-slate-400">
                            {r.customerInfo.phone}
                          </div>
                        </td>
                        <td className="py-2 align-top">{it.productName}</td>
                        <td className="py-2 text-right align-top">
                          {it.totalItems}
                        </td>
                        <td className="py-2 text-right align-top">
                          ₹
                          {(
                            typeof it.lineAmount === "number"
                              ? it.lineAmount
                              : (it.unitPrice ?? 0) * it.totalItems
                          ).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MONTH WISE BILLS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 mb-2">
            Month-wise bills
          </p>
          <div className="max-h-56 overflow-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-slate-500">
                  <th className="py-1.5">Month</th>
                  <th className="py-1.5 text-right">Bills</th>
                  <th className="py-1.5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {monthWiseBills.map(([k, v]) => (
                  <tr
                    key={k}
                    className="border-t border-slate-100 text-slate-700"
                  >
                    <td className="py-2">{k}</td>
                    <td className="py-2 text-right">{v.bills}</td>
                    <td className="py-2 text-right">
                      {formatCurrency(v.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DRIVERS & CUSTOMERS */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* DRIVER PERFORMANCE TABLE */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-900 flex items-center gap-2">
              <Truck className="h-4 w-4 text-[color:var(--color-primary)]" />
              Top drivers (by collection)
            </p>
          </div>

          {driverSummary.length === 0 && (
            <p className="text-xs text-slate-500">
              No driver order data in selected range.
            </p>
          )}

          {driverSummary.length > 0 && (
            <div className="max-h-60 overflow-y-auto">
              <table className="min-w-full border-collapse text-[11px]">
                <thead className="bg-slate-50 text-slate-500 sticky top-0">
                  <tr>
                    <th className="border-b border-slate-200 px-2 py-1 text-left">
                      Driver
                    </th>
                    <th className="border-b border-slate-200 px-2 py-1 text-right">
                      Orders
                    </th>
                    <th className="border-b border-slate-200 px-2 py-1 text-right">
                      Delivered
                    </th>
                    <th className="border-b border-slate-200 px-2 py-1 text-right">
                      Collected
                    </th>
                    <th className="border-b border-slate-200 px-2 py-1 text-right">
                      Outstanding
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {driverSummary.map((d) => (
                    <tr key={d.driverId} className="text-slate-700">
                      <td className="border-b border-slate-100 px-2 py-1 text-left">
                        {d.name}
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1 text-right">
                        {d.orders}
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1 text-right">
                        {d.delivered}
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1 text-right">
                        {formatCurrency(d.collected)}
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1 text-right">
                        {formatCurrency(d.outstanding)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 flex justify-end text-[11px] text-slate-500">
            <button
              type="button"
              onClick={() => router.push("/admin/drivers")}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
            >
              Manage drivers
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* TOP CUSTOMERS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-900 flex items-center gap-2">
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
                <thead className="bg-slate-50 text-slate-500 sticky top-0">
                  <tr>
                    <th className="border-b border-slate-200 px-2 py-1 text-left">
                      Customer
                    </th>
                    <th className="border-b border-slate-200 px-2 py-1 text-right">
                      Orders
                    </th>
                    <th className="border-b border-slate-200 px-2 py-1 text-right">
                      Total
                    </th>
                    <th className="border-b border-slate-200 px-2 py-1 text-right">
                      Outstanding
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((c, idx) => (
                    <tr key={`${c.phone}-${idx}`} className="text-slate-700">
                      <td className="border-b border-slate-100 px-2 py-1 text-left">
                        <div className="flex flex-col">
                          <span>{c.name}</span>
                          <span className="text-[10px] text-slate-400">
                            {c.phone}
                          </span>
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1 text-right">
                        {c.orders}
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1 text-right">
                        {formatCurrency(c.total)}
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1 text-right">
                        {formatCurrency(c.outstanding)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>Top 5 customers in selected period.</span>
            <button
              type="button"
              onClick={() => router.push("/admin/payment")}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
            >
              View all customers (orders)
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {billsLoading && (
        <p className="text-[11px] text-slate-500">Loading billing data...</p>
      )}
    </div>
  );
}

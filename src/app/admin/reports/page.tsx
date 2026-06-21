"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store/store";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Download,
  Package,
  ReceiptIndianRupee,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { fetchInventory } from "@/store/inventorySlice";
import { fetchProducts } from "@/store/productSlice";
import { fetchPurchases, Purchase } from "@/store/purchaseSlice";
import { useListBillsQuery, Bill } from "@/store/billingApi";
import { normalizeInventoryUnitPrices } from "@/lib/inventoryPricing";
import { ddMmYyyyToIso, isoToDdMmYyyy } from "@/lib/ddMmYyyyInput";

type ReturnRecord = {
  _id: string;
  billId?: string;
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
  name?: string;
  perBoxItem?: number;
  purchasePrice?: number;
  sellingPrice?: number;
  price?: number;
};

type InventoryItem = {
  _id?: string;
  id?: string;
  productId?: unknown;
  product?: unknown;
  boxes?: number | string;
  looseItems?: number | string;
  totalItems?: number;
  lowStockBoxes?: number | string | null;
  lowStockItems?: number | string | null;
};

type PurchaseItem = {
  boxes?: number;
  looseItems?: number;
  perBoxItem?: number;
  totalQty?: number;
  totalAmount?: number;
  taxableAmount?: number;
  taxAmount?: number;
  productId?: {
    _id?: string;
    name?: string;
    perBoxItem?: number;
  } | string;
};

type SummaryCardProps = {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  tone: "slate" | "emerald" | "sky" | "amber" | "rose" | "indigo";
};

type StockStats = {
  totalItems: number;
  purchaseValue: number;
  sellingValue: number;
  lowStock: number;
  outOfStock: number;
};

const toneClasses: Record<SummaryCardProps["tone"], string> = {
  slate: "border-slate-200 bg-white text-slate-900",
  emerald: "border-emerald-100 bg-emerald-50 text-emerald-900",
  sky: "border-sky-100 bg-sky-50 text-sky-900",
  amber: "border-amber-100 bg-amber-50 text-amber-900",
  rose: "border-rose-100 bg-rose-50 text-rose-900",
  indigo: "border-indigo-100 bg-indigo-50 text-indigo-900",
};

const extractId = (ref: unknown): string | undefined => {
  if (ref == null) return undefined;
  if (typeof ref === "string" || typeof ref === "number") return String(ref);
  if (typeof ref === "object") {
    const obj = ref as Record<string, unknown>;
    const id = obj._id ?? obj.id;
    return id ? String(id) : undefined;
  }
  return undefined;
};

const toNumber = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const toInputDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getCurrentYearRange = () => {
  const now = new Date();
  return {
    from: toInputDate(new Date(now.getFullYear(), 0, 1)),
    to: toInputDate(new Date(now.getFullYear(), 11, 31)),
  };
};

const formatDisplayDate = (date: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

const formatNumber = (value: number): string =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);

const isWithinDateRange = (dateStr: string | undefined, from: string, to: string) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;

  const fromDate = new Date(from);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  return date >= fromDate && date <= toDate;
};

const getPurchaseDate = (purchase: Purchase) =>
  purchase.purchaseDate || purchase.createdAt;

const getProductPerBox = (inv: InventoryItem, products: Product[]): number => {
  const productFromInventory = inv.product as Product | undefined;
  if (typeof productFromInventory?.perBoxItem === "number" && productFromInventory.perBoxItem > 0) {
    return productFromInventory.perBoxItem;
  }

  const pid = extractId(inv.productId ?? inv.product);
  const product = products.find((p) => String(p._id ?? p.id) === pid);
  return product?.perBoxItem && product.perBoxItem > 0 ? product.perBoxItem : 1;
};

const getProductPrices = (inv: InventoryItem, products: Product[]) => {
  const productFromInventory = inv.product as Product | undefined;
  const pid = extractId(inv.productId ?? inv.product);
  const product =
    productFromInventory ??
    products.find((p) => String(p._id ?? p.id) === String(pid));

  return product ? normalizeInventoryUnitPrices(product) : { purchase: 0, selling: 0 };
};

const getReturnAmount = (record: ReturnRecord): number => {
  if (typeof record.totalAmount === "number") return record.totalAmount;

  return record.items.reduce((sum, item) => {
    if (typeof item.lineAmount === "number") return sum + item.lineAmount;
    return sum + toNumber(item.unitPrice) * toNumber(item.totalItems);
  }, 0);
};

function SummaryCard({ title, value, note, icon, tone }: SummaryCardProps) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
            {title}
          </p>
          <p className="mt-2 break-words text-2xl font-semibold">{value}</p>
        </div>
        <div className="rounded-md bg-white/80 p-2 shadow-sm">{icon}</div>
      </div>
      <p className="mt-3 text-xs leading-5 opacity-75">{note}</p>
    </div>
  );
}

export default function ReportsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const defaultRange = useMemo(getCurrentYearRange, []);

  const { products } = useSelector((s: RootState) => s.product);
  const { items: inventory } = useSelector((s: RootState) => s.inventory);
  const { list: purchases, loading: purchasesLoading } = useSelector(
    (s: RootState) => s.purchase
  );

  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [fromDateText, setFromDateText] = useState(() =>
    isoToDdMmYyyy(defaultRange.from)
  );
  const [toDateText, setToDateText] = useState(() =>
    isoToDdMmYyyy(defaultRange.to)
  );
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [cashBreakdownOpen, setCashBreakdownOpen] = useState(false);
  const [upiBreakdownOpen, setUpiBreakdownOpen] = useState(false);

  const { data: billsData, isLoading: billsLoading, refetch } =
    useListBillsQuery({ search: "" });

  const bills = useMemo(() => billsData?.bills ?? [], [billsData]);

  useEffect(() => {
    dispatch(fetchProducts());
    dispatch(fetchInventory());
    dispatch(fetchPurchases());
  }, [dispatch]);

  useEffect(() => {
    fetch("/api/returns")
      .then((res) => res.json())
      .then((data) => setReturns(data.returns ?? []))
      .catch(() => setReturns([]));
  }, []);

  const selectedRangeLabel = `${formatDisplayDate(fromDate)} to ${formatDisplayDate(toDate)}`;

  useEffect(() => {
    setFromDateText(isoToDdMmYyyy(fromDate));
  }, [fromDate]);

  useEffect(() => {
    setToDateText(isoToDdMmYyyy(toDate));
  }, [toDate]);

  const applyFromDateText = () => {
    const iso = ddMmYyyyToIso(fromDateText);
    if (!iso) {
      window.alert("Invalid From date. Use DD/MM/YYYY.");
      return;
    }
    setFromDate(iso);
  };

  const applyToDateText = () => {
    const iso = ddMmYyyyToIso(toDateText);
    if (!iso) {
      window.alert("Invalid To date. Use DD/MM/YYYY.");
      return;
    }
    setToDate(iso);
  };

  const filteredBills = useMemo(
    () => bills.filter((bill) => isWithinDateRange(bill.billDate, fromDate, toDate)),
    [bills, fromDate, toDate]
  );

  const filteredPurchases = useMemo(
    () =>
      purchases.filter((purchase) =>
        isWithinDateRange(getPurchaseDate(purchase), fromDate, toDate)
      ),
    [purchases, fromDate, toDate]
  );

  const filteredReturns = useMemo(
    () => returns.filter((record) => isWithinDateRange(record.createdAt, fromDate, toDate)),
    [returns, fromDate, toDate]
  );

  const salesStats = useMemo(() => {
    return filteredBills.reduce(
      (acc, bill: Bill) => {
        acc.billCount += 1;
        acc.grossSales += toNumber(bill.grandTotal);
        acc.collected += toNumber(bill.amountCollected);
        acc.outstanding += toNumber(bill.balanceAmount);
        acc.tax += toNumber(bill.totalTax);
        acc.itemsSold += toNumber(bill.totalItems);
        acc.cash += toNumber(bill.payment?.cashAmount);
        acc.upi += toNumber(bill.payment?.upiAmount);
        acc.card += toNumber(bill.payment?.cardAmount);

        bill.items.forEach((item) => {
          const key = item.productName || extractId(item.product) || "Unknown product";
          const current = acc.productMap.get(key) ?? {
            name: key,
            qty: 0,
            amount: 0,
          };
          current.qty += toNumber(item.totalItems);
          current.amount += toNumber(item.lineTotal);
          acc.productMap.set(key, current);
        });

        return acc;
      },
      {
        billCount: 0,
        grossSales: 0,
        collected: 0,
        outstanding: 0,
        tax: 0,
        itemsSold: 0,
        cash: 0,
        upi: 0,
        card: 0,
        productMap: new Map<string, { name: string; qty: number; amount: number }>(),
      }
    );
  }, [filteredBills]);

  const purchaseStats = useMemo(() => {
    return filteredPurchases.reduce(
      (acc, purchase) => {
        acc.purchaseCount += 1;
        acc.totalPurchase += toNumber(purchase.grandTotal);

        (purchase.items as PurchaseItem[]).forEach((item) => {
          const perBox = toNumber(item.perBoxItem) || 1;
          const qty =
            toNumber(item.totalQty) ||
            toNumber(item.boxes) * perBox + toNumber(item.looseItems);
          acc.itemsPurchased += qty;
          acc.tax += toNumber(item.taxAmount);
        });

        return acc;
      },
      {
        purchaseCount: 0,
        totalPurchase: 0,
        itemsPurchased: 0,
        tax: 0,
      }
    );
  }, [filteredPurchases]);

  const returnStats = useMemo(() => {
    return filteredReturns.reduce(
      (acc, record) => {
        acc.returnCount += 1;
        const amount = getReturnAmount(record);
        acc.returnAmount += amount;
        if (record.billId) {
          acc.billLinkedReturnAmount += amount;
        } else {
          acc.manualReturnAmount += amount;
        }
        acc.returnItems += record.items.reduce(
          (sum, item) => sum + toNumber(item.totalItems),
          0
        );
        return acc;
      },
      {
        returnCount: 0,
        returnAmount: 0,
        billLinkedReturnAmount: 0,
        manualReturnAmount: 0,
        returnItems: 0,
      }
    );
  }, [filteredReturns]);

  const stockStats = useMemo(() => {
    return (inventory as InventoryItem[]).reduce<StockStats>(
      (acc, inv) => {
        const perBox = getProductPerBox(inv, products as Product[]);
        const totalItems =
          typeof inv.totalItems === "number"
            ? inv.totalItems
            : toNumber(inv.boxes) * perBox + toNumber(inv.looseItems);
        const prices = getProductPrices(inv, products as Product[]);
        const lowStockLimit = toNumber(inv.lowStockBoxes ?? 1) * perBox + toNumber(inv.lowStockItems);

        acc.totalItems += totalItems;
        acc.purchaseValue += totalItems * toNumber(prices.purchase);
        acc.sellingValue += totalItems * toNumber(prices.selling);
        if (totalItems === 0) acc.outOfStock += 1;
        else if (totalItems <= lowStockLimit) acc.lowStock += 1;

        return acc;
      },
      {
        totalItems: 0,
        purchaseValue: 0,
        sellingValue: 0,
        lowStock: 0,
        outOfStock: 0,
      }
    );
  }, [inventory, products]);

  // Bill grandTotals are already reduced when a bill return is processed.
  // Only manual returns (no linked bill) need a separate sales adjustment.
  const netSales = salesStats.grossSales - returnStats.manualReturnAmount;

  const periodFlow = useMemo(
    () => ({
      itemsPurchased: purchaseStats.itemsPurchased,
      itemsSold: salesStats.itemsSold,
      itemsInStock: stockStats.totalItems,
    }),
    [purchaseStats.itemsPurchased, salesStats.itemsSold, stockStats.totalItems]
  );

  const cashCollectedBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    filteredBills.forEach((bill) => {
      const c = toNumber(bill.payment?.cashAmount);
      if (c <= 0) return;
      const label = (
        bill.customerInfo.shopName ||
        bill.customerInfo.name ||
        "Customer"
      ).trim();
      m.set(label, (m.get(label) ?? 0) + c);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredBills]);

  const upiCollectedBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    filteredBills.forEach((bill) => {
      const c = toNumber(bill.payment?.upiAmount);
      if (c <= 0) return;
      const label = (
        bill.customerInfo.shopName ||
        bill.customerInfo.name ||
        "Customer"
      ).trim();
      m.set(label, (m.get(label) ?? 0) + c);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredBills]);

  const monthRows = useMemo(() => {
    const map = new Map<
      string,
      { label: string; bills: number; sales: number; purchases: number; returns: number }
    >();

    const ensureMonth = (dateStr: string) => {
      const date = new Date(dateStr);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) {
        map.set(key, {
          label: new Intl.DateTimeFormat("en-IN", {
            month: "short",
            year: "numeric",
          }).format(date),
          bills: 0,
          sales: 0,
          purchases: 0,
          returns: 0,
        });
      }
      return map.get(key)!;
    };

    filteredBills.forEach((bill) => {
      const row = ensureMonth(bill.billDate);
      row.bills += 1;
      row.sales += toNumber(bill.grandTotal);
    });

    filteredPurchases.forEach((purchase) => {
      const row = ensureMonth(getPurchaseDate(purchase));
      row.purchases += toNumber(purchase.grandTotal);
    });

    filteredReturns.forEach((record) => {
      const row = ensureMonth(record.createdAt);
      row.returns += getReturnAmount(record);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, row]) => {
        const netSell = row.sales - row.returns;
        const purchaseVsSalesBalance = Math.max(0, row.purchases - netSell);
        return { ...row, purchaseVsSalesBalance };
      });
  }, [filteredBills, filteredPurchases, filteredReturns]);

  const topProducts = useMemo(() => {
    return Array.from(salesStats.productMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [salesStats.productMap]);

  const resetToCurrentYear = useCallback(() => {
    setFromDate(defaultRange.from);
    setToDate(defaultRange.to);
  }, [defaultRange.from, defaultRange.to]);

  const refreshAll = useCallback(() => {
    refetch();
    dispatch(fetchPurchases({ force: true }));
    dispatch(fetchInventory({ force: true }));
  }, [dispatch, refetch]);

  const quickSetThisMonth = () => {
    const now = new Date();
    setFromDate(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
    setToDate(toInputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  };

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Admin report
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Business Performance Report
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Simple totals for bills, sales, purchases, stock value, outstanding, and refunds for {selectedRangeLabel}.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
            <div className="flex flex-wrap items-end gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-slate-500">
                  From <span className="font-normal text-slate-400">(DD/MM/YYYY)</span>
                </span>
                <div className="flex gap-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="DD/MM/YYYY"
                    value={fromDateText}
                    onChange={(e) => setFromDateText(e.target.value)}
                    onBlur={applyFromDateText}
                    className="h-9 w-36 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                  <button
                    type="button"
                    onClick={applyFromDateText}
                    className="h-9 rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Apply
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-slate-500">
                  To <span className="font-normal text-slate-400">(DD/MM/YYYY)</span>
                </span>
                <div className="flex gap-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="DD/MM/YYYY"
                    value={toDateText}
                    onChange={(e) => setToDateText(e.target.value)}
                    onBlur={applyToDateText}
                    className="h-9 w-36 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                  <button
                    type="button"
                    onClick={applyToDateText}
                    className="h-9 rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Apply
                  </button>
                </div>
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={quickSetThisMonth}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:border-sky-300 hover:text-sky-700"
          >
            <CalendarDays className="h-4 w-4" />
            This month
          </button>
          <button
            type="button"
            onClick={resetToCurrentYear}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:border-sky-300 hover:text-sky-700"
          >
            <RotateCcw className="h-4 w-4" />
            Current year
          </button>
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Total bills"
          value={formatNumber(salesStats.billCount)}
          note="Bills created in the selected date range."
          icon={<ReceiptIndianRupee className="h-5 w-5 text-slate-600" />}
          tone="slate"
        />
        <SummaryCard
          title="Total sell"
          value={formatCurrency(netSales)}
          note={`Sales from ${formatNumber(salesStats.billCount)} bills in this period (${formatNumber(periodFlow.itemsSold)} items). This is money received from customers — not the same as stock value below.`}
          icon={<BarChart3 className="h-5 w-5 text-emerald-600" />}
          tone="emerald"
        />
        <SummaryCard
          title="Total purchase"
          value={formatCurrency(purchaseStats.totalPurchase)}
          note={`${formatNumber(purchaseStats.purchaseCount)} purchase bills (${formatNumber(periodFlow.itemsPurchased)} items bought). Total paid to dealers in period — not current stock cost (see Stock value).`}
          icon={<ShoppingBag className="h-5 w-5 text-sky-600" />}
          tone="sky"
        />
        <SummaryCard
          title="Stock value (unsold)"
          value={formatCurrency(stockStats.sellingValue)}
          note={`${formatNumber(stockStats.totalItems)} items in warehouse now. At purchase cost: ${formatCurrency(stockStats.purchaseValue)}. Live inventory — not period purchase/sales.`}
          icon={<Package className="h-5 w-5 text-indigo-600" />}
          tone="indigo"
        />
        <SummaryCard
          title="Outstanding"
          value={formatCurrency(salesStats.outstanding)}
          note={`Collected ${formatCurrency(salesStats.collected)} from customers.`}
          icon={<Wallet className="h-5 w-5 text-rose-600" />}
          tone="rose"
        />
        <SummaryCard
          title="Refund amount"
          value={formatCurrency(returnStats.returnAmount)}
          note={
            returnStats.billLinkedReturnAmount > 0
              ? `${formatNumber(returnStats.returnCount)} returns. ${formatCurrency(returnStats.billLinkedReturnAmount)} already reduced in bill totals above.`
              : `${formatNumber(returnStats.returnCount)} returns in the selected date range.`
          }
          icon={<Download className="h-5 w-5 text-amber-600" />}
          tone="amber"
        />
      </div>

      <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Why inventory and report totals differ
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Purchase and sell cards show <strong>period activity</strong> (money
          spent or collected in the selected dates). Stock value shows{" "}
          <strong>what is left in the warehouse today</strong> at product list
          prices. Sold goods are no longer in stock, so these numbers are
          expected to differ.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-sky-100 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
              Bought in period
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {formatCurrency(purchaseStats.totalPurchase)}
            </p>
            <p className="text-xs text-slate-500">
              {formatNumber(periodFlow.itemsPurchased)} items from dealers
            </p>
          </div>
          <div className="rounded-md border border-emerald-100 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              Sold in period
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {formatCurrency(netSales)}
            </p>
            <p className="text-xs text-slate-500">
              {formatNumber(periodFlow.itemsSold)} items to customers
            </p>
          </div>
          <div className="rounded-md border border-indigo-100 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
              In stock now
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {formatCurrency(stockStats.sellingValue)}
            </p>
            <p className="text-xs text-slate-500">
              {formatNumber(periodFlow.itemsInStock)} items · cost{" "}
              {formatCurrency(stockStats.purchaseValue)}
            </p>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Sales and Purchase Summary</h2>
              <p className="mt-1 text-xs text-slate-500">
                Month-wise totals inside the selected date range.{" "}
                <span className="text-slate-400">
                  &quot;Est. purchase stock&quot; is max(0, month purchases − net month sales); it is a rough indicator, not full inventory costing.
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/admin/purchase")}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-sky-300 hover:text-sky-700"
            >
              Purchase page
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">Month</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Bills</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Total sell</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Total purchase</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Refund</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                    Est. purchase stock (₹)
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-sm text-slate-500" colSpan={6}>
                      No report data found for this date range.
                    </td>
                  </tr>
                ) : (
                  monthRows.map((row) => {
                    const netMonthSales = row.sales - row.returns;
                    return (
                      <tr key={row.label} className="border-t border-slate-100">
                        <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-800">
                          {row.label}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          {formatNumber(row.bills)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-emerald-700">
                          {formatCurrency(netMonthSales)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-sky-700">
                          {formatCurrency(row.purchases)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-amber-700">
                          {formatCurrency(row.returns)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-slate-700">
                          {formatCurrency(row.purchaseVsSalesBalance)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Cash Flow Snapshot</h2>
              <p className="mt-1 text-xs text-slate-500">
                Payment collection and liabilities for the selected period.
              </p>
            </div>
            <ClipboardList className="h-5 w-5 text-slate-400" />
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-md bg-slate-50">
              <button
                type="button"
                onClick={() => setCashBreakdownOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-100/80"
              >
                <span className="text-sm text-slate-600">Cash collected</span>
                <span className="text-sm font-semibold text-slate-900">
                  {formatCurrency(salesStats.cash)}
                </span>
              </button>
              {cashBreakdownOpen && (
                <div className="border-t border-slate-200 px-3 py-2 text-xs">
                  {cashCollectedBreakdown.length === 0 ? (
                    <p className="text-slate-500">No cash payments in this range.</p>
                  ) : (
                    <ul className="max-h-48 space-y-1 overflow-y-auto">
                      {cashCollectedBreakdown.map(([name, amt]) => (
                        <li
                          key={`cash-${name}`}
                          className="flex justify-between gap-2 text-slate-700"
                        >
                          <span className="truncate">{name}</span>
                          <span className="shrink-0 font-medium">
                            {formatCurrency(amt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-md bg-slate-50">
              <button
                type="button"
                onClick={() => setUpiBreakdownOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-100/80"
              >
                <span className="text-sm text-slate-600">UPI collected</span>
                <span className="text-sm font-semibold text-slate-900">
                  {formatCurrency(salesStats.upi)}
                </span>
              </button>
              {upiBreakdownOpen && (
                <div className="border-t border-slate-200 px-3 py-2 text-xs">
                  {upiCollectedBreakdown.length === 0 ? (
                    <p className="text-slate-500">No UPI payments in this range.</p>
                  ) : (
                    <ul className="max-h-48 space-y-1 overflow-y-auto">
                      {upiCollectedBreakdown.map(([name, amt]) => (
                        <li
                          key={`upi-${name}`}
                          className="flex justify-between gap-2 text-slate-700"
                        >
                          <span className="truncate">{name}</span>
                          <span className="shrink-0 font-medium">
                            {formatCurrency(amt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {[
              ["Card collected", salesStats.card],
              ["Customer outstanding", salesStats.outstanding],
              ["Purchase total", purchaseStats.totalPurchase],
              ["Refund total", returnStats.returnAmount],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2"
              >
                <span className="text-sm text-slate-600">{label}</span>
                <span className="text-sm font-semibold text-slate-900">
                  {formatCurrency(value as number)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Top Selling Products</h2>
              <p className="mt-1 text-xs text-slate-500">
                Products ranked by billed amount.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/admin/orders")}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-sky-300 hover:text-sky-700"
            >
              Orders
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Product</th>
                  <th className="px-3 py-2 text-right font-semibold">Sold qty</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-sm text-slate-500" colSpan={3}>
                      No product sales found.
                    </td>
                  </tr>
                ) : (
                  topProducts.map((product) => (
                    <tr key={product.name} className="border-t border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-800">
                        {product.name}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatNumber(product.qty)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold">
                        {formatCurrency(product.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Current Stock Health</h2>
              <p className="mt-1 text-xs text-slate-500">
                Stock availability is current live inventory, not historical.
              </p>
            </div>
            <Package className="h-5 w-5 text-slate-400" />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Available items</p>
              <p className="mt-1 text-2xl font-semibold">{formatNumber(stockStats.totalItems)}</p>
            </div>
            <div className="rounded-md bg-rose-50 p-3">
              <p className="text-xs text-rose-600">Out of stock products</p>
              <p className="mt-1 text-2xl font-semibold text-rose-700">
                {formatNumber(stockStats.outOfStock)}
              </p>
            </div>
            <div className="rounded-md bg-amber-50 p-3">
              <p className="text-xs text-amber-700">Low stock products</p>
              <p className="mt-1 text-2xl font-semibold text-amber-800">
                {formatNumber(stockStats.lowStock)}
              </p>
            </div>
            <div className="rounded-md bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700">Estimated selling value</p>
              <p className="mt-1 text-lg font-semibold text-emerald-800">
                {formatCurrency(stockStats.sellingValue)}
              </p>
            </div>
          </div>
        </section>
      </div>

      {(billsLoading || purchasesLoading) && (
        <p className="mt-4 text-xs text-slate-500">Loading latest report data...</p>
      )}
    </div>
  );
}

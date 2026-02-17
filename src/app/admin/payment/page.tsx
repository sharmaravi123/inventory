"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  IndianRupee,
  Calendar,
  ChevronRight,
  CreditCard,
  Smartphone,
  Banknote,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  X,
  Users,
  FileText,
} from "lucide-react";
import { useListBillsQuery, Bill } from "@/store/billingApi";

/* =============== TYPES =============== */

type PaymentSplit = {
  cashAmount: number;
  upiAmount: number;
  cardAmount: number;
};

type DateFilterType = "all" | "thisMonth" | "lastMonth" | "custom";

type CustomerAgg = {
  customerId: string;
  name: string;
  shopName?: string;
  phone: string;
  bills: Bill[];
  totalOrders: number;
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
  periodOrders: number;
  periodBilled: number;
  periodPaid: number;
  periodDue: number;
};

/* =============== SAFE HELPERS =============== */

const getBillDue = (bill: Bill): number => Number(bill.balanceAmount || 0);
const getBillPaid = (bill: Bill): number => Number(bill.amountCollected || 0);
const isBillPending = (bill: Bill): boolean => getBillDue(bill) > 0;

// Allow optional backend date fields safely
type BillWithDates = Bill & {
  invoiceDate?: string;
  createdAt?: string;
  updatedAt?: string;
};

const getBillDate = (bill: Bill): Date | null => {
  const b = bill as BillWithDates;
  const raw = b.invoiceDate || b.updatedAt || b.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  // Normalize to start of day for stable comparisons
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

/* =============== DATE UTILS =============== */

function startOfMonth(d: Date = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function formatCurrency(n: number) {
  return `₹${Math.round(Math.max(0, n)).toLocaleString("en-IN")}`;
}

function formatDateInput(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/* =============== COMPONENT =============== */

export default function PaymentsDashboardPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilterType, setDateFilterType] =
    useState<DateFilterType>("thisMonth");
  const [fromDate, setFromDate] = useState(formatDateInput(startOfMonth()));
  const [toDate, setToDate] = useState(formatDateInput(endOfMonth()));

  const [selectedCustomerId, setSelectedCustomerId] =
    useState<string | null>(null);

  const [paymentSplit, setPaymentSplit] = useState<PaymentSplit>({
    cashAmount: 0,
    upiAmount: 0,
    cardAmount: 0,
  });

  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    shopName: "",
    address: "",
    gstNumber: "",
  });

  const [addingCustomer, setAddingCustomer] = useState(false);

  const { data, isLoading, refetch } = useListBillsQuery({ search: "" });

  const bills: Bill[] = data?.bills ?? [];

  const parsedFrom = useMemo(() => parseDateInput(fromDate), [fromDate]);
  const parsedTo = useMemo(() => parseDateInput(toDate), [toDate]);

  /* =============== DATE FILTER =============== */

  const isWithinRange = (bill: Bill): boolean => {
    const d = getBillDate(bill);
    if (!d) return true; // if backend has no date, do not exclude silently

    const today = new Date();
    const startToday = startOfMonth(today); // will reuse in thisMonth / lastMonth

    if (dateFilterType === "all") return true;

    if (dateFilterType === "thisMonth") {
      const start = startOfMonth(today);
      const end = endOfMonth(today);
      return d >= start && d <= end;
    }

    if (dateFilterType === "lastMonth") {
      const lastStart = startOfMonth(
        new Date(today.getFullYear(), today.getMonth() - 1, 1)
      );
      const lastEnd = endOfMonth(
        new Date(today.getFullYear(), today.getMonth() - 1, 1)
      );
      return d >= lastStart && d <= lastEnd;
    }

    // custom
    if (!parsedFrom || !parsedTo) return true;
    return d >= parsedFrom && d <= parsedTo;
  };

  /* =============== GLOBAL STATS (PERIOD AWARE) =============== */

  const stats = useMemo(() => {
    let totalOrders = 0;
    let totalBilled = 0;
    let totalPaid = 0;
    let totalDue = 0;

    let periodOrders = 0;
    let periodBilled = 0;
    let periodPaid = 0;
    let periodDue = 0;

    const customerMap = new Map<string, CustomerAgg>();

    for (const bill of bills) {
      const info = bill.customerInfo || {};
      const cid =
        info.phone ||
        info.customer ||
        info.name ||
        `unknown-${bill._id}`;

      if (!customerMap.has(cid)) {
        customerMap.set(cid, {
          customerId: cid,
          name: info.name || "Unknown",
          shopName: info.shopName || "",
          phone: info.phone || "-",
          bills: [],
          totalOrders: 0,
          totalBilled: 0,
          totalPaid: 0,
          totalDue: 0,
          periodOrders: 0,
          periodBilled: 0,
          periodPaid: 0,
          periodDue: 0,
        });
      }

      const entry = customerMap.get(cid)!;
      entry.bills.push(bill);

      const due = getBillDue(bill);
      const paid = getBillPaid(bill);
      const billed = due + paid;

      // global totals (all time)
      totalOrders += 1;
      totalBilled += billed;
      totalPaid += paid;
      totalDue += due;

      entry.totalOrders += 1;
      entry.totalBilled += billed;
      entry.totalPaid += paid;
      entry.totalDue += due;

      // period totals
      if (isWithinRange(bill)) {
        periodOrders += 1;
        periodBilled += billed;
        periodPaid += paid;
        periodDue += due;

        entry.periodOrders += 1;
        entry.periodBilled += billed;
        entry.periodPaid += paid;
        entry.periodDue += due;
      }
    }

    return {
      totalOrders,
      totalBilled,
      totalPaid,
      totalDue,
      periodOrders,
      periodBilled,
      periodPaid,
      periodDue,
      totalCustomers: customerMap.size,
    };
  }, [bills, dateFilterType, parsedFrom, parsedTo]);

  /* =============== CUSTOMERS =============== */

  const [allCustomers, setAllCustomers] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setAllCustomers(d.customers ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAllCustomers([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const customersAggregated = useMemo(() => {
    const map = new Map<string, CustomerAgg>();

    // Add all customers even without bills
    for (const cust of allCustomers) {
      const cid = cust.phone || cust._id || cust.name;
      if (!cid) continue;

      if (!map.has(cid)) {
        map.set(cid, {
          customerId: cid,
          name: cust.name || "Unknown",
          shopName: cust.shopName || "",
          phone: cust.phone || "-",
          bills: [],
          totalOrders: 0,
          totalBilled: 0,
          totalPaid: 0,
          totalDue: 0,
          periodOrders: 0,
          periodBilled: 0,
          periodPaid: 0,
          periodDue: 0,
        });
      }
    }

    // Merge bills
    for (const bill of bills) {
      const info = bill.customerInfo || {};
      const cid = info.phone || info.customer || info.name;
      if (!cid) continue;

      if (!map.has(cid)) {
        map.set(cid, {
          customerId: cid,
          name: info.name || "Unknown",
          shopName: info.shopName || "",
          phone: cid,
          bills: [],
          totalOrders: 0,
          totalBilled: 0,
          totalPaid: 0,
          totalDue: 0,
          periodOrders: 0,
          periodBilled: 0,
          periodPaid: 0,
          periodDue: 0,
        });
      }

      const entry = map.get(cid)!;
      if (!entry.shopName && info.shopName) {
        entry.shopName = info.shopName;
      }
      entry.bills.push(bill);

      const due = getBillDue(bill);
      const paid = getBillPaid(bill);
      const billed = due + paid;

      entry.totalOrders += 1;
      entry.totalBilled += billed;
      entry.totalPaid += paid;
      entry.totalDue += due;

      if (isWithinRange(bill)) {
        entry.periodOrders += 1;
        entry.periodBilled += billed;
        entry.periodPaid += paid;
        entry.periodDue += due;
      }
    }

    let arr = Array.from(map.values());

    // search
    if (searchTerm.trim()) {
      const st = searchTerm.toLowerCase();
      arr = arr.filter(
        (c) =>
          c.name.toLowerCase().includes(st) ||
          (c.shopName || "").toLowerCase().includes(st) ||
          c.phone.toLowerCase().includes(st)
      );
    }

    // sort by period orders desc, then total due desc
    arr.sort((a, b) => {
      if (b.periodOrders !== a.periodOrders) {
        return b.periodOrders - a.periodOrders;
      }
      return b.totalDue - a.totalDue;
    });

    return arr;
  }, [allCustomers, bills, searchTerm, dateFilterType, parsedFrom, parsedTo]);

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return (
      customersAggregated.find((c) => c.customerId === selectedCustomerId) ||
      null
    );
  }, [customersAggregated, selectedCustomerId]);

  const selectedPendingBills = useMemo(() => {
    if (!selectedCustomer) return [];
    return selectedCustomer.bills
      .filter(isBillPending)
      .sort((a, b) => {
        const n1 = parseInt(
          (a.invoiceNumber || "").match(/\d+$/)?.[0] || "999999",
          10
        );
        const n2 = parseInt(
          (b.invoiceNumber || "").match(/\d+$/)?.[0] || "999999",
          10
        );
        return n1 - n2;
      });
  }, [selectedCustomer]);

  const totalDueSelected = useMemo(() => {
    return selectedPendingBills.reduce(
      (sum, bill) => sum + getBillDue(bill),
      0
    );
  }, [selectedPendingBills]);

  const totalPaymentAmount =
    paymentSplit.cashAmount +
    paymentSplit.upiAmount +
    paymentSplit.cardAmount;

  const paymentPreview = useMemo(() => {
    let remaining = totalPaymentAmount;
    return selectedPendingBills.map((bill) => {
      const due = getBillDue(bill);
      const allocated = Math.min(remaining, due);
      remaining -= allocated;
      return {
        billId: bill._id!,
        billNumber: bill.invoiceNumber || bill._id!.slice(-6),
        due,
        allocated,
        remainingDue: Math.max(0, due - allocated),
      };
    });
  }, [selectedPendingBills, totalPaymentAmount]);

  const handleOpenPayment = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setPaymentSplit({ cashAmount: 0, upiAmount: 0, cardAmount: 0 });
    setError("");
  };

  const handleClosePayment = () => {
    setSelectedCustomerId(null);
    setPaymentSplit({ cashAmount: 0, upiAmount: 0, cardAmount: 0 });
    setError("");
  };

  const handleMakePayment = async () => {
    if (
      !selectedCustomer ||
      totalPaymentAmount <= 0 ||
      totalPaymentAmount > totalDueSelected
    ) {
      setError("Invalid payment amount");
      return;
    }

    setUpdating(true);
    setError("");

    try {
      let remaining = totalPaymentAmount;
      const totalInput = totalPaymentAmount || 1;
      const cashRatio = paymentSplit.cashAmount / totalInput;
      const upiRatio = paymentSplit.upiAmount / totalInput;
      const cardRatio = paymentSplit.cardAmount / totalInput;

      for (const bill of selectedPendingBills) {
        if (remaining <= 0) break;
        const due = getBillDue(bill);
        const payNow = Math.min(remaining, due);

        const basePayment = {
          cashAmount: Number(bill.payment?.cashAmount || 0),
          upiAmount: Number(bill.payment?.upiAmount || 0),
          cardAmount: Number(bill.payment?.cardAmount || 0),
        };

        const billCash = Math.round(payNow * cashRatio);
        const billUpi = Math.round(payNow * upiRatio);
        const billCard = payNow - billCash - billUpi;

        const paymentUpdate = {
          cashAmount: basePayment.cashAmount + billCash,
          upiAmount: basePayment.upiAmount + billUpi,
          cardAmount: basePayment.cardAmount + billCard,
        };

        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            billId: bill._id,
            amountCollected: getBillPaid(bill) + payNow,
            balanceAmount: Math.max(0, due - payNow),
            payment: paymentUpdate,
          }),
        });

        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error || "Payment failed");
        }

        remaining -= payNow;
      }

      setSuccessMsg(
        `${formatCurrency(totalPaymentAmount)} recorded for ${
          selectedCustomer.shopName || selectedCustomer.name
        }`
      );
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      await refetch();
      handleClosePayment();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-lg text-slate-600 font-medium">
            Loading payments...
          </p>
        </div>
      </div>
    );
  }

  const dateLabel =
    dateFilterType === "all"
      ? "All time"
      : dateFilterType === "thisMonth"
      ? "This month"
      : dateFilterType === "lastMonth"
      ? "Last month"
      : parsedFrom && parsedTo
      ? `${parsedFrom.toLocaleDateString("en-IN")} - ${parsedTo.toLocaleDateString(
          "en-IN"
        )}`
      : "Custom range";

  return (
    <div className="min-h-screen bg-slate-50 py-4 px-3 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* TOP BAR */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase">
              Collections
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
              Payment Collection Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Track outstanding dues and collect payments from customers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              onClick={() => setShowAddCustomer(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700"
            >
              + Add Customer
            </button>
          </div>
        </header>

        {/* STATS GRID */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Orders (Period)
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {stats.periodOrders.toLocaleString()}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {stats.totalOrders.toLocaleString()} total orders
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Billed (Period)
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {formatCurrency(stats.periodBilled)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatCurrency(stats.totalBilled)} total billed
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50">
                <IndianRupee className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Due (All Time)
                </p>
                <p className="mt-1 text-2xl font-bold text-rose-600">
                  {formatCurrency(stats.totalDue)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatCurrency(stats.periodDue)} due in period
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50">
                <IndianRupee className="h-5 w-5 text-rose-600" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Active Customers
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {stats.totalCustomers}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">With bills / saved</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50">
                <Users className="h-5 w-5 text-violet-600" />
              </div>
            </div>
          </div>
        </section>

        {/* FILTERS CARD */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="w-full md:max-w-sm relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by customer name or phone"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { type: "all" as DateFilterType, label: "All time" },
                { type: "thisMonth" as DateFilterType, label: "This month" },
                { type: "lastMonth" as DateFilterType, label: "Last month" },
                { type: "custom" as DateFilterType, label: "Custom" },
              ].map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => setDateFilterType(type)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    dateFilterType === type
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {dateFilterType === "custom" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  From
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  To
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-slate-500">
            Showing data for: <span className="font-medium">{dateLabel}</span>
          </p>
        </section>

        {/* CUSTOMERS LIST */}
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Customers & dues
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Sorted by orders in selected period and total due.
              </p>
            </div>
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {customersAggregated.length} customers
            </span>
          </div>

          {/* Mobile cards */}
          <div className="block divide-y divide-slate-100 md:hidden">
            {customersAggregated.map((c) => (
              <div key={c.customerId} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {c.shopName || c.name}
                    </p>
                    <p className="text-xs text-slate-500">{c.phone}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {c.periodOrders} orders in period ·{" "}
                      {formatCurrency(c.totalDue)} due
                    </p>
                  </div>
                  <button
                    onClick={() => handleOpenPayment(c.customerId)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    Collect
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-3 pl-6 pr-2 text-left">Customer</th>
                  <th className="px-2 py-3 text-left">Phone</th>
                  <th className="px-2 py-3 text-center">Total Orders</th>
                  <th className="px-2 py-3 text-center">Orders (Period)</th>
                  <th className="px-2 py-3 text-right">Billed</th>
                  <th className="px-2 py-3 text-right">Paid</th>
                  <th className="px-2 py-3 text-right">Due</th>
                  <th className="py-3 pl-2 pr-6 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {customersAggregated.map((c) => (
                  <tr
                    key={c.customerId}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-3 pl-6 pr-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900">
                          {c.shopName || c.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {c.periodOrders} orders in period
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-xs font-mono text-slate-700">
                      {c.phone}
                    </td>
                    <td className="px-2 py-3 text-center text-sm font-semibold text-slate-900">
                      {c.totalOrders}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {c.periodOrders}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right text-sm font-semibold text-slate-900">
                      {formatCurrency(c.totalBilled)}
                    </td>
                    <td className="px-2 py-3 text-right text-sm font-semibold text-emerald-700">
                      {formatCurrency(c.totalPaid)}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                          c.totalDue > 0
                            ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
                            : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                        }`}
                      >
                        {formatCurrency(c.totalDue)}
                      </span>
                    </td>
                    <td className="py-3 pl-2 pr-6 text-center">
                      <button
                        onClick={() => handleOpenPayment(c.customerId)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                      >
                        Collect
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {customersAggregated.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-6 text-center text-sm text-slate-500"
                    >
                      No customers match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* PAYMENT PANEL – STRUCTURE KEPT, STYLES ONLY LIGHTLY TUNED */}
        {selectedCustomer && (
          <div className="fixed inset-0 z-50 flex">
            <div
              className="flex-1 bg-black/40 backdrop-blur-sm"
              onClick={handleClosePayment}
            />
            <div className="flex max-h-screen w-full max-w-lg flex-col border border-white/50 bg-white/95 backdrop-blur-xl shadow-2xl">
              {/* Header */}
              <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Record Payment
                    </h3>
                    <p className="text-xs text-slate-600">
                      Split across Cash, UPI and Card.
                    </p>
                  </div>
                  <button
                    onClick={handleClosePayment}
                    className="rounded-xl p-1.5 hover:bg-slate-200"
                  >
                    <X className="h-4 w-4 text-slate-600" />
                  </button>
                </div>
              </div>

              {/* Customer Info */}
              <div className="border-b border-slate-100 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg">
                      <IndianRupee className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-slate-900">
                        {selectedCustomer.shopName || selectedCustomer.name}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {selectedCustomer.phone}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Total Pending
                    </p>
                    <p className="text-xl font-bold text-rose-600">
                      {formatCurrency(totalDueSelected)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Split Inputs */}
              <div className="border-b border-slate-100 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Payment split
                  </span>
                  <span className="text-xs font-semibold text-slate-700">
                    Total:{" "}
                    <span className="text-sm font-bold">
                      {formatCurrency(totalPaymentAmount)}
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      key: "cashAmount" as const,
                      icon: Banknote,
                      label: "Cash",
                      color: "emerald",
                    },
                    {
                      key: "upiAmount" as const,
                      icon: Smartphone,
                      label: "UPI",
                      color: "indigo",
                    },
                    {
                      key: "cardAmount" as const,
                      icon: CreditCard,
                      label: "Card",
                      color: "purple",
                    },
                  ].map(({ key, icon: Icon, label, color }) => (
                    <div
                      key={key}
                      className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3"
                    >
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <Icon
                          className={`h-4 w-4 text-${color}-600`}
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                          {label}
                        </span>
                      </div>
                      <div className="relative">
                        <IndianRupee className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="number"
                          min={0}
                          value={paymentSplit[key] || ""}
                          onChange={(e) =>
                            setPaymentSplit((prev) => ({
                              ...prev,
                              [key]: Number(e.target.value) || 0,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white pl-7 pr-2.5 py-2 text-xs font-mono tracking-wide text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invoices Preview */}
              <div className="flex-1 overflow-y-auto p-2">
                <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 px-3 py-2">
                  <h5 className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Invoice allocation (oldest first)
                  </h5>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-[11px]">
                    <thead className="bg-slate-50/70">
                      <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        <th className="py-1.5 pl-3 pr-2 text-left">Invoice</th>
                        <th className="px-2 py-1.5 text-right">Due</th>
                        <th className="px-2 py-1.5 text-right">Paid now</th>
                        <th className="px-2 py-1.5 text-right">Balance</th>
                        <th className="py-1.5 pl-2 pr-3 text-center">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {paymentPreview.map((p) => (
                        <tr
                          key={p.billId}
                          className="border-t border-slate-100 hover:bg-slate-50/70"
                        >
                          <td className="py-1.5 pl-3 pr-2 font-mono font-semibold text-slate-800">
                            #{p.billNumber}
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold text-slate-800">
                            {formatCurrency(p.due)}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {p.allocated > 0 ? (
                              <span className="font-semibold text-emerald-600">
                                -{formatCurrency(p.allocated)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold text-slate-800">
                            {formatCurrency(p.remainingDue)}
                          </td>
                          <td className="py-1.5 pl-2 pr-3 text-center">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-semibold ${
                                p.remainingDue === 0
                                  ? "bg-emerald-100 text-emerald-800"
                                  : p.allocated > 0
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {p.remainingDue === 0
                                ? "Cleared"
                                : p.allocated > 0
                                ? "Partial"
                                : "Pending"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {paymentPreview.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-3 text-center text-[11px] text-slate-500"
                          >
                            No pending invoices for this customer.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Button */}
              <div className="border-t border-slate-100 bg-slate-50/70 p-5">
                <button
                  onClick={handleMakePayment}
                  disabled={
                    updating ||
                    totalPaymentAmount <= 0 ||
                    selectedPendingBills.length === 0
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-700/50 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-blue-700 hover:to-blue-800 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400"
                >
                  {updating ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <IndianRupee className="h-4 w-4" />
                      Record {formatCurrency(totalPaymentAmount)} payment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUCCESS TOAST */}
        {showSuccess && (
          <div className="fixed right-4 top-4 z-50 max-w-sm animate-slide-in rounded-2xl border border-emerald-700/40 bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3 text-white shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold">Payment successful</p>
                <p className="text-[11px] opacity-90">{successMsg}</p>
              </div>
            </div>
          </div>
        )}

        {/* ERROR TOAST */}
        {error && (
          <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-rose-700/40 bg-gradient-to-r from-rose-600 to-rose-700 px-4 py-3 text-white shadow-2xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold">Payment failed</p>
                <p className="text-[11px] opacity-90">{error}</p>
                <button
                  onClick={() => setError("")}
                  className="mt-1 text-[11px] underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADD CUSTOMER DIALOG */}
        {showAddCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowAddCustomer(false)}
            />
            <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <h3 className="mb-4 text-lg font-bold text-slate-900">
                Add new customer
              </h3>

              <div className="space-y-3">
                <input
                  placeholder="Customer name *"
                  value={newCustomer.name}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      name: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />

                <input
                  placeholder="Phone number (optional)"
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      phone: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />

                <input
                  placeholder="Store / shop name"
                  value={newCustomer.shopName}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      shopName: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />

                <textarea
                  placeholder="Address"
                  rows={3}
                  value={newCustomer.address}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      address: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />

                <input
                  placeholder="GSTIN (optional)"
                  value={newCustomer.gstNumber}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      gstNumber: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setShowAddCustomer(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  disabled={addingCustomer || !newCustomer.name}
                  onClick={async () => {
                    if (!newCustomer.name) return;

                    setAddingCustomer(true);
                    try {
                      await fetch("/api/customers", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(newCustomer),
                      });

                      setShowAddCustomer(false);
                      setNewCustomer({
                        name: "",
                        phone: "",
                        shopName: "",
                        address: "",
                        gstNumber: "",
                      });

                      refetch();
                    } finally {
                      setAddingCustomer(false);
                    }
                  }}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {addingCustomer ? "Saving..." : "Save customer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

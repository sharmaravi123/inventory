"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type PeriodType = "all" | "thisMonth" | "lastMonth" | "custom";

type LedgerResponse = {
  customer: {
    id: string;
    name: string;
    shopName?: string;
    phone?: string;
    address?: string;
    gstNumber?: string;
  };
  totals: {
    allTime: { totalBilled: number; totalPaid: number; totalRemaining: number };
    thisMonth: { totalBilled: number; totalPaid: number; totalRemaining: number };
    lastMonth: { totalBilled: number; totalPaid: number; totalRemaining: number };
    selected: { totalBilled: number; totalPaid: number; totalRemaining: number };
  };
  billCount: { allTime: number; selected: number };
  bills: Array<{
    id: string;
    invoiceNumber: string;
    billDate: string | null;
    grandTotal: number;
    amountCollected: number;
    balanceAmount: number;
    status: string;
  }>;
};

const formatMoney = (value: number) =>
  `₹${Math.round(Math.max(0, value)).toLocaleString("en-IN")}`;

const formatDateInput = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

export default function CustomerDetailsPage() {
  const { customerKey } = useParams<{ customerKey: string }>();
  const router = useRouter();

  const [period, setPeriod] = useState<PeriodType>("thisMonth");
  const [fromDate, setFromDate] = useState(() => formatDateInput(startOfMonth(new Date())));
  const [toDate, setToDate] = useState(() => formatDateInput(endOfMonth(new Date())));
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLedger = useCallback(async () => {
    if (!customerKey) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ period });
      if (period === "custom") {
        params.set("from", fromDate);
        params.set("to", toDate);
      }
      const res = await fetch(`/api/customer-ledger/${encodeURIComponent(customerKey)}?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load customer details");
      }
      setData(json as LedgerResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load customer details");
    } finally {
      setLoading(false);
    }
  }, [customerKey, period, fromDate, toDate]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  const customerTitle = useMemo(() => {
    if (!data) return "Customer";
    return data.customer.shopName || data.customer.name || "Customer";
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Loading customer details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-rose-600">{error}</p>
          <button
            onClick={() => router.push("/admin/payment")}
            className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Customer Details</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">{customerTitle}</h1>
              <p className="mt-1 text-sm text-slate-500">{data.customer.phone || "-"}</p>
              {data.customer.address && <p className="text-sm text-slate-500">{data.customer.address}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/admin/payment")}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Back
              </button>
              <button
                onClick={() => {
                  const params = new URLSearchParams({ period });
                  if (period === "custom") {
                    params.set("from", fromDate);
                    params.set("to", toDate);
                  }
                  router.push(
                    `/admin/payment/customer/${encodeURIComponent(customerKey)}/preview?${params.toString()}`
                  );
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Preview / Print
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs text-slate-500">This Month Total Bill</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{formatMoney(data.totals.thisMonth.totalBilled)}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs text-slate-500">Last Month Total Bill</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{formatMoney(data.totals.lastMonth.totalBilled)}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs text-slate-500">All Time Total Bill</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{formatMoney(data.totals.allTime.totalBilled)}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs text-slate-500">Remaining (All Time)</p>
            <p className="mt-1 text-xl font-bold text-rose-600">{formatMoney(data.totals.allTime.totalRemaining)}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { value: "all" as PeriodType, label: "All Time" },
                { value: "thisMonth" as PeriodType, label: "This Month" },
                { value: "lastMonth" as PeriodType, label: "Last Month" },
                { value: "custom" as PeriodType, label: "Custom" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setPeriod(tab.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    period === tab.value
                      ? "bg-blue-600 text-white"
                      : "bg-slate-50 text-slate-700 ring-1 ring-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => void loadLedger()}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              Refresh
            </button>
          </div>

          {period === "custom" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Selected Period Billed</p>
              <p className="text-sm font-bold text-slate-900">{formatMoney(data.totals.selected.totalBilled)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Selected Period Paid</p>
              <p className="text-sm font-bold text-emerald-700">{formatMoney(data.totals.selected.totalPaid)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Selected Period Remaining</p>
              <p className="text-sm font-bold text-rose-600">{formatMoney(data.totals.selected.totalRemaining)}</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Bills List</h2>
            <span className="text-xs text-slate-500">{data.billCount.selected} bills</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-3 pl-4 pr-2 text-left">Invoice</th>
                  <th className="px-2 py-3 text-left">Date</th>
                  <th className="px-2 py-3 text-right">Bill</th>
                  <th className="px-2 py-3 text-right">Paid</th>
                  <th className="px-2 py-3 text-right">Remaining</th>
                  <th className="py-3 pl-2 pr-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.bills.map((bill) => (
                  <tr key={bill.id}>
                    <td className="py-3 pl-4 pr-2 font-medium text-slate-900">#{bill.invoiceNumber}</td>
                    <td className="px-2 py-3 text-slate-600">
                      {bill.billDate ? new Date(bill.billDate).toLocaleDateString("en-IN") : "-"}
                    </td>
                    <td className="px-2 py-3 text-right font-semibold text-slate-900">{formatMoney(bill.grandTotal)}</td>
                    <td className="px-2 py-3 text-right font-semibold text-emerald-700">{formatMoney(bill.amountCollected)}</td>
                    <td className="px-2 py-3 text-right font-semibold text-rose-600">{formatMoney(bill.balanceAmount)}</td>
                    <td className="py-3 pl-2 pr-4 text-center text-xs text-slate-600">{bill.status}</td>
                  </tr>
                ))}
                {data.bills.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                      No bills found for selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

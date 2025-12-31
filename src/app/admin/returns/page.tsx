// src/app/admin/returns/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import AddReturnModal from "@/app/admin/components/returns/AddReturnModal";
import ManualReturnModal from "@/app/admin/components/returns/ManualReturnForm";
type ReturnItem = {
  productName: string;
  quantityBoxes: number;
  quantityLoose: number;
  itemsPerBox: number;
  totalItems: number;
  unitPrice?: number;
  taxPercent?: number;
  lineAmount?: number;
};

type ReturnCustomerInfo = {
  name: string;
  shopName?: string;
  phone: string;
  address: string;
  gstNumber?: string;
};

type ReturnRecord = {
  _id: string;
  billId: string;
  invoiceNumber?: string;
  customerInfo: ReturnCustomerInfo;
  reason?: string;
  note?: string;
  items: ReturnItem[];
  totalAmount?: number;
  createdAt: string;
};

type ReturnsApiResponse = {
  returns: ReturnRecord[];
};

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [manualOpen, setManualOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const fetchReturns = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/returns");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to fetch returns");
      }

      const data = (await res.json()) as ReturnsApiResponse;
      setReturns(data.returns ?? []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch returns";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReturns();
  }, []);
  const getPriceWithoutGST = (
    sellingPrice: number,
    taxPercent?: number
  ): number => {
    if (!taxPercent || taxPercent <= 0) return sellingPrice;
    return sellingPrice / (1 + taxPercent / 100);
  };
  const computeReturnAmount = (r: ReturnRecord): number => {
  if (typeof r.totalAmount === 'number') return r.totalAmount;
  
  return r.items.reduce((sum, item) => {
    return sum + (item.lineAmount || 0);  // ✅ Use saved lineAmount directly
  }, 0);
}

  const filteredReturns = useMemo(() => {
    return returns.filter((r) => {
      const text = [
        r.customerInfo.name,
        r.customerInfo.shopName ?? "",
        r.customerInfo.phone,
        r.invoiceNumber ?? "",
        r.reason ?? "",
        r.note ?? "",
      ]
        .join(" ")
        .toLowerCase();

      if (search.trim() && !text.includes(search.toLowerCase())) {
        return false;
      }

      const created = new Date(r.createdAt);

      if (fromDate) {
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);
        if (created < from) return false;
      }

      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        if (created > to) return false;
      }

      return true;
    });
  }, [returns, search, fromDate, toDate]);

  const {
    totalReturnsCount,
    totalAmount,
    todayAmount,
    monthAmount,
    yearAmount,
  } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    let total = 0;
    let today = 0;
    let month = 0;
    let year = 0;

    filteredReturns.forEach((r) => {
      const amount = computeReturnAmount(r);
      total += amount;

      const d = new Date(r.createdAt);
      const y = d.getFullYear();
      const m = d.getMonth();
      const day = d.getDate();

      if (y === currentYear) {
        year += amount;
        if (m === currentMonth) {
          month += amount;
          if (day === currentDay) {
            today += amount;
          }
        }
      }
    });

    return {
      totalReturnsCount: filteredReturns.length,
      totalAmount: total,
      todayAmount: today,
      monthAmount: month,
      yearAmount: year,
    };
  }, [filteredReturns]);

  const handleResetFilters = (): void => {
    setSearch("");
    setFromDate("");
    setToDate("");
  };

  const formatDateTime = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[color:var(--color-sidebar)]">
            Returns
          </h1>
          <p className="text-xs text-slate-500">
            Customer returns history, quantities, and return value analytics.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void fetchReturns()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
          >
            Refresh
          </button>

          {/* 🔵 MANUAL RETURN */}
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="rounded-lg border border-dashed border-[color:var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-primary)]"
          >
            Manual Return
          </button>

          {/* 🟢 BILL BASED RETURN */}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-lg bg-[color:var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-white)]"
          >
            Add Return
          </button>
        </div>

      </div>

      {/* ANALYTICS CARDS */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl bg-[color:var(--color-white)] p-3 shadow-sm">
          <p className="text-[11px] text-slate-500">
            Total Returns (filtered)
          </p>
          <p className="mt-1 text-2xl font-semibold text-[color:var(--color-sidebar)]">
            {totalReturnsCount}
          </p>
        </div>

        <div className="rounded-xl bg-[color:var(--color-white)] p-3 shadow-sm">
          <p className="text-[11px] text-slate-500">Today Return Amount</p>
          <p className="mt-1 text-lg font-semibold text-[color:var(--color-primary)]">
            ₹{todayAmount.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl bg-[color:var(--color-white)] p-3 shadow-sm">
          <p className="text-[11px] text-slate-500">This Month Return</p>
          <p className="mt-1 text-lg font-semibold text-[color:var(--color-primary)]">
            ₹{monthAmount.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl bg-[color:var(--color-white)] p-3 shadow-sm">
          <p className="text-[11px] text-slate-500">This Year Return</p>
          <p className="mt-1 text-lg font-semibold text-[color:var(--color-primary)]">
            ₹{yearAmount.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl bg-[color:var(--color-white)] p-3 shadow-sm">
          <p className="text-[11px] text-slate-500">Total Return Amount</p>
          <p className="mt-1 text-lg font-semibold text-[color:var(--color-primary)]">
            ₹{totalAmount.toFixed(2)}
          </p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="rounded-xl bg-[color:var(--color-white)] p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4 md:items-end">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              Search
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              placeholder="Customer / phone / shop / reason / note"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex items-end justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
            >
              Reset filters
            </button>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          {loading
            ? "Loading returns..."
            : `Showing ${filteredReturns.length} of ${returns.length} returns`}
        </div>

        {error && (
          <p className="mt-2 text-xs text-[color:var(--color-error)]">
            {error}
          </p>
        )}
      </div>

      {/* LIST */}
      <div className="rounded-xl bg-[color:var(--color-white)] p-4 shadow-sm">
        {filteredReturns.length === 0 && !loading && (
          <p className="text-sm text-slate-500">No returns found.</p>
        )}

        <div className="max-h-[520px] space-y-3 overflow-y-auto">
          {filteredReturns.map((r) => {
            const amount = computeReturnAmount(r);
            const totalPieces = r.items.reduce(
              (sum, it) => sum + it.totalItems,
              0
            );

            return (
              <div
                key={r._id}
                className="rounded-lg border border-slate-200 p-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(r.createdAt)}
                    </p>
                    <p className="text-sm font-semibold text-slate-800">
                      {r.customerInfo.name}{" "}
                      {r.customerInfo.shopName && (
                        <span className="text-[11px] text-slate-600">
                          ({r.customerInfo.shopName})
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {r.customerInfo.phone}
                    </p>
                    {r.invoiceNumber && (
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Invoice:{" "}
                        <span className="font-mono">
                          {r.invoiceNumber}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="text-right text-xs">
                    <p className="font-semibold text-[color:var(--color-primary)]">
                      Return Amount: ₹{amount.toFixed(2)}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Lines: {r.items.length} • Total pcs: {totalPieces}
                    </p>
                  </div>
                </div>

                {r.reason && (
                  <p className="mt-1 text-[11px] text-slate-600">
                    Reason: {r.reason}
                  </p>
                )}
                {r.note && (
                  <p className="text-[11px] text-slate-500">
                    Note: {r.note}
                  </p>
                )}

                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full border-collapse text-[11px]">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="border-b px-2 py-1 text-left">
                          Item
                        </th>
                        <th className="border-b px-2 py-1 text-right">
                          Boxes
                        </th>
                        <th className="border-b px-2 py-1 text-right">
                          Loose
                        </th>
                        <th className="border-b px-2 py-1 text-right">
                          Total pcs
                        </th>
                        <th className="border-b px-2 py-1 text-right">
                          Price/pc
                        </th>
                        <th className="border-b px-2 py-1 text-right">
                          Line Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.items.map((it, idx) => {
                        const unitPrice = typeof it.unitPrice === 'number'
                          ? it.unitPrice  // Backend already sends GST-removed price
                          : 0;
                        const lineAmount = typeof it.lineAmount === 'number'
                          ? it.lineAmount  // Backend already sends correct amount
                          : unitPrice * it.totalItems;

                        return (
                          <tr key={`${r._id}-${idx}`}>
                            <td className="border-b px-2 py-1 text-left">
                              {it.productName}
                            </td>
                            <td className="border-b px-2 py-1 text-right">
                              {it.quantityBoxes}
                            </td>
                            <td className="border-b px-2 py-1 text-right">
                              {it.quantityLoose}
                            </td>
                            <td className="border-b px-2 py-1 text-right">
                              {it.totalItems}
                            </td>
                            <td className="border-b px-2 py-1 text-right">
                              {unitPrice > 0
                                ? `₹${unitPrice.toFixed(2)}`
                                : "-"}
                            </td>
                            <td className="border-b px-2 py-1 text-right">
                              {lineAmount > 0
                                ? `₹${lineAmount.toFixed(2)}`
                                : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ADD RETURN MODAL */}
      <AddReturnModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          void fetchReturns();
        }}
      />
      <ManualReturnModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={() => {
          setManualOpen(false);
          void fetchReturns(); // ✅ LIST + STATS auto update
        }}
      />
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, IndianRupee, RefreshCw } from "lucide-react";

type Dealer = {
  _id: string;
  name: string;
};

type LedgerEntry = {
  type: "PURCHASE" | "PAYMENT";
  id: string;
  date: string;
  amount: number;
  paymentMode?: "CASH" | "UPI" | "CARD";
  invoiceNumber?: string;
  note?: string;
};

type PaymentRow = {
  id: string;
  amount: number;
  date: string;
  paymentMode?: "CASH" | "UPI" | "CARD";
  note?: string;
};

type LedgerResponse = {
  entries: LedgerEntry[];
  payments: PaymentRow[];
  summary: {
    totalPurchase: number;
    totalPaid: number;
    balance: number;
  };
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function getToken() {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("admin_token")
  );
}

function monthNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PurchaseCreditDebitPage() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(monthNow());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [ledger, setLedger] = useState<LedgerResponse>({
    entries: [],
    payments: [],
    summary: { totalPurchase: 0, totalPaid: 0, balance: 0 },
  });

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(todayValue());
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "CARD">("CASH");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const loadDealers = useCallback(async () => {
    try {
      const res = await fetch("/api/dealers", { cache: "no-store" });
      const data = await res.json();
      const list = Array.isArray(data?.dealers) ? data.dealers : [];
      setDealers(list);
      if (list.length > 0) {
        setSelectedDealerId((prev) => prev || String(list[0]._id));
      }
    } catch {
      setError("Failed to load dealers");
    }
  }, []);

  const loadLedger = useCallback(async (dealerId: string, month: string) => {
    if (!dealerId) return;
    setLoading(true);
    setError("");
    try {
      const token = getToken();
      const res = await fetch(
        `/api/purchase-ledger?dealerId=${dealerId}&month=${month}`,
        {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load ledger");
      }
      setLedger({
        entries: Array.isArray(data.entries) ? data.entries : [],
        payments: Array.isArray(data.payments) ? data.payments : [],
        summary: data.summary || { totalPurchase: 0, totalPaid: 0, balance: 0 },
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load ledger";
      setError(message);
      setLedger({
        entries: [],
        payments: [],
        summary: { totalPurchase: 0, totalPaid: 0, balance: 0 },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDealers();
  }, [loadDealers]);

  useEffect(() => {
    if (!selectedDealerId) return;
    loadLedger(selectedDealerId, selectedMonth);
  }, [selectedDealerId, selectedMonth, loadLedger]);

  const resetPaymentForm = () => {
    setEditingPaymentId(null);
    setPaymentAmount("");
    setPaymentDate(todayValue());
    setPaymentMode("CASH");
    setPaymentNote("");
  };

  const startEdit = (paymentId: string) => {
    const payment = ledger.payments.find((p) => p.id === paymentId);
    if (!payment) return;
    setEditingPaymentId(payment.id);
    setPaymentAmount(String(payment.amount || ""));
    setPaymentDate(
      payment.date ? new Date(payment.date).toISOString().slice(0, 10) : todayValue()
    );
    setPaymentMode(payment.paymentMode || "CASH");
    setPaymentNote(payment.note || "");
  };

  const savePayment = async () => {
    if (!selectedDealerId) return;
    const amount = Number(paymentAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Amount should be greater than 0");
      return;
    }
    if (!paymentDate) {
      setError("Please select payment date");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const token = getToken();
      const url = editingPaymentId
        ? `/api/purchase-ledger/${editingPaymentId}`
        : "/api/purchase-ledger";
      const method = editingPaymentId ? "PUT" : "POST";
      const body = editingPaymentId
        ? { amount, paymentMode, paymentDate, note: paymentNote }
        : { dealerId: selectedDealerId, amount, paymentMode, paymentDate, note: paymentNote };

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save payment");
      }

      resetPaymentForm();
      await loadLedger(selectedDealerId, selectedMonth);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save payment";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const balanceText = useMemo(() => {
    const balance = Number(ledger.summary.balance || 0);
    if (balance === 0) return "Month settled: purchases and payments are balanced.";
    if (balance > 0) return `Outstanding payable: ${currency.format(balance)} remains payable to the dealer.`;
    return `Advance paid: ${currency.format(Math.abs(balance))} has been paid in excess to the dealer.`;
  }, [ledger.summary.balance]);

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Admin</p>
            <h1 className="text-2xl font-bold text-slate-900">Purchase Credit / Debit Ledger</h1>
            <p className="text-sm text-slate-500">Dealer-wise monthly purchase vs payment tracking</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <CalendarDays className="h-4 w-4 text-slate-500" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => loadLedger(selectedDealerId, selectedMonth)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <div className="flex min-w-max gap-2">
            {dealers.map((dealer) => (
              <button
                key={dealer._id}
                type="button"
                onClick={() => setSelectedDealerId(dealer._id)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  selectedDealerId === dealer._id
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {dealer.name}
              </button>
            ))}
            {dealers.length === 0 && (
              <span className="px-1 text-sm text-slate-500">No dealers found</span>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Purchase</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {currency.format(ledger.summary.totalPurchase || 0)}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Paid</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">
              {currency.format(ledger.summary.totalPaid || 0)}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs uppercase tracking-wide text-slate-500">Balance</p>
            <p className={`mt-1 text-xl font-bold ${ledger.summary.balance > 0 ? "text-rose-700" : "text-blue-700"}`}>
              {currency.format(Math.abs(ledger.summary.balance || 0))}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-lg font-bold text-slate-900">
            {editingPaymentId ? "Edit Dealer Payment" : "Add Dealer Payment"}
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-5">
            <input
              type="number"
              min="0"
              placeholder="Amount"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as "CASH" | "UPI" | "CARD")}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
            </select>
            <input
              type="text"
              placeholder="Note (optional)"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving || !selectedDealerId}
                onClick={savePayment}
                className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {saving ? "Saving..." : editingPaymentId ? "Update" : "Add"}
              </button>
              {editingPaymentId && (
                <button
                  type="button"
                  onClick={resetPaymentForm}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Entry</th>
                  <th className="px-4 py-3 text-left">By</th>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.entries.map((row) => (
                  <tr key={`${row.type}-${row.id}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-800">
                      {new Date(row.date).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          row.type === "PURCHASE"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {row.type === "PURCHASE" ? "Purchase" : "Payment"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.type === "PAYMENT" ? row.paymentMode || "CASH" : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.type === "PURCHASE"
                        ? `Invoice: ${row.invoiceNumber || "-"}`
                        : row.note || "Dealer payment"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-700">
                      {row.type === "PURCHASE" ? currency.format(row.amount || 0) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                      {row.type === "PAYMENT" ? currency.format(row.amount || 0) : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.type === "PAYMENT" ? (
                        <button
                          type="button"
                          onClick={() => startEdit(row.id)}
                          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && ledger.entries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                      No ledger data for selected month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-start gap-2 text-sm text-slate-700">
            <IndianRupee className="mt-0.5 h-4 w-4 text-slate-500" />
            <p>{balanceText}</p>
          </div>
          {error && <p className="mt-2 text-sm font-medium text-rose-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}

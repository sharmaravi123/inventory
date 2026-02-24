"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Download,
  IndianRupee,
  Printer,
  RefreshCw,
  X,
} from "lucide-react";

type Dealer = {
  _id: string;
  name: string;
  phone?: string;
  address?: string;
  gstin?: string;
};

type CompanyProfile = {
  name: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  gstin: string;
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

type LedgerSummary = LedgerResponse["summary"];

type DisplayLedgerRow = {
  key: string;
  id: string;
  type: "PURCHASE" | "PAYMENT";
  dateText: string;
  entryText: string;
  byText: string;
  referenceText: string;
  debitText: string;
  creditText: string;
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function formatMonthLabel(month: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText);
  if (!year || !monthIndex) return month;
  return new Date(year, monthIndex - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function previousMonthValue(month: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText);
  if (!year || !monthIndex) return monthNow();
  const value = new Date(year, monthIndex - 1, 1);
  value.setMonth(value.getMonth() - 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function LedgerTable({
  rows,
  loading,
  allowEdit,
  onEdit,
}: {
  rows: DisplayLedgerRow[];
  loading: boolean;
  allowEdit: boolean;
  onEdit: (paymentId: string) => void;
}) {
  return (
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
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-800">{row.dateText}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    row.type === "PURCHASE"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {row.entryText}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-700">{row.byText}</td>
              <td className="px-4 py-3 text-slate-700">{row.referenceText}</td>
              <td className="px-4 py-3 text-right font-semibold text-rose-700">{row.debitText}</td>
              <td className="px-4 py-3 text-right font-semibold text-emerald-700">{row.creditText}</td>
              <td className="px-4 py-3 text-center">
                {allowEdit && row.type === "PAYMENT" ? (
                  <button
                    type="button"
                    onClick={() => onEdit(row.id)}
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
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                No ledger data for selected month.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function PurchaseCreditDebitPage() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(monthNow());
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>({
    name: "Company",
    addressLine1: "",
    addressLine2: "",
    phone: "",
    gstin: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [ledger, setLedger] = useState<LedgerResponse>({
    entries: [],
    payments: [],
    summary: { totalPurchase: 0, totalPaid: 0, balance: 0 },
  });
  const [previousMonthSummary, setPreviousMonthSummary] = useState<LedgerSummary>({
    totalPurchase: 0,
    totalPaid: 0,
    balance: 0,
  });
  const [previousLoading, setPreviousLoading] = useState(false);

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(todayValue());
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "CARD">("CASH");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const ledgerCacheRef = useRef<Map<string, LedgerResponse>>(new Map());
  const activeLedgerRequestRef = useRef<AbortController | null>(null);

  const selectedDealer = useMemo(() => {
    return dealers.find((dealer) => dealer._id === selectedDealerId) ?? null;
  }, [dealers, selectedDealerId]);

  const selectedDealerName = selectedDealer?.name || "Dealer";

  const companyAddress = useMemo(() => {
    return [companyProfile.addressLine1, companyProfile.addressLine2].filter(Boolean).join(", ");
  }, [companyProfile.addressLine1, companyProfile.addressLine2]);

  const monthLabel = useMemo(() => formatMonthLabel(selectedMonth), [selectedMonth]);
  const previousMonth = useMemo(() => previousMonthValue(selectedMonth), [selectedMonth]);
  const previousMonthLabel = useMemo(() => formatMonthLabel(previousMonth), [previousMonth]);

  const displayRows = useMemo<DisplayLedgerRow[]>(() => {
    return ledger.entries.map((row) => {
      return {
        key: `${row.type}-${row.id}`,
        id: row.id,
        type: row.type,
        dateText: new Date(row.date).toLocaleDateString("en-IN"),
        entryText: row.type === "PURCHASE" ? "Purchase" : "Payment",
        byText: row.type === "PAYMENT" ? row.paymentMode || "CASH" : "-",
        referenceText:
          row.type === "PURCHASE" ? `Invoice: ${row.invoiceNumber || "-"}` : row.note || "Payment entry",
        debitText: row.type === "PURCHASE" ? currency.format(row.amount || 0) : "-",
        creditText: row.type === "PAYMENT" ? currency.format(row.amount || 0) : "-",
      };
    });
  }, [ledger.entries]);

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

  const loadCompanyProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/company-profile", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setCompanyProfile({
        name: typeof data?.name === "string" && data.name.trim() ? data.name.trim() : "Company",
        addressLine1: typeof data?.addressLine1 === "string" ? data.addressLine1.trim() : "",
        addressLine2: typeof data?.addressLine2 === "string" ? data.addressLine2.trim() : "",
        phone: typeof data?.phone === "string" ? data.phone.trim() : "",
        gstin: typeof data?.gstin === "string" ? data.gstin.trim() : "",
      });
    } catch {
      // Keep fallback name
    }
  }, []);

  const loadLedger = useCallback(
    async (dealerId: string, month: string, options?: { force?: boolean }) => {
      if (!dealerId) return;
      const cacheKey = `${dealerId}__${month}`;

      if (!options?.force) {
        const cached = ledgerCacheRef.current.get(cacheKey);
        if (cached) {
          setLedger(cached);
          return;
        }
      }

      activeLedgerRequestRef.current?.abort();
      const controller = new AbortController();
      activeLedgerRequestRef.current = controller;

      setLoading(true);
      setError("");
      try {
        const token = getToken();
        const res = await fetch(
          `/api/purchase-ledger?dealerId=${dealerId}&month=${month}`,
          {
            cache: "no-store",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            signal: controller.signal,
          }
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load ledger");
        }

        const nextLedger: LedgerResponse = {
          entries: Array.isArray(data.entries) ? data.entries : [],
          payments: Array.isArray(data.payments) ? data.payments : [],
          summary: data.summary || { totalPurchase: 0, totalPaid: 0, balance: 0 },
        };
        ledgerCacheRef.current.set(cacheKey, nextLedger);
        setLedger(nextLedger);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        const message = e instanceof Error ? e.message : "Failed to load ledger";
        setError(message);
        setLedger({
          entries: [],
          payments: [],
          summary: { totalPurchase: 0, totalPaid: 0, balance: 0 },
        });
      } finally {
        if (activeLedgerRequestRef.current === controller) {
          activeLedgerRequestRef.current = null;
          setLoading(false);
        }
      }
    },
    []
  );

  const loadMonthSummary = useCallback(async (dealerId: string, month: string) => {
    if (!dealerId) return;
    setPreviousLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/purchase-ledger?dealerId=${dealerId}&month=${month}`, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load previous month summary");
      setPreviousMonthSummary(
        data?.summary || { totalPurchase: 0, totalPaid: 0, balance: 0 }
      );
    } catch {
      setPreviousMonthSummary({ totalPurchase: 0, totalPaid: 0, balance: 0 });
    } finally {
      setPreviousLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadDealers(), loadCompanyProfile()]);
  }, [loadDealers, loadCompanyProfile]);

  useEffect(() => {
    if (!selectedDealerId) return;
    void loadLedger(selectedDealerId, selectedMonth);
  }, [selectedDealerId, selectedMonth, loadLedger]);

  useEffect(() => {
    if (!selectedDealerId) return;
    void loadMonthSummary(selectedDealerId, previousMonth);
  }, [selectedDealerId, previousMonth, loadMonthSummary]);

  useEffect(() => {
    return () => activeLedgerRequestRef.current?.abort();
  }, []);

  const clearDealerCache = useCallback((dealerId: string) => {
    const prefix = `${dealerId}__`;
    for (const key of ledgerCacheRef.current.keys()) {
      if (key.startsWith(prefix)) ledgerCacheRef.current.delete(key);
    }
  }, []);

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
        : {
            dealerId: selectedDealerId,
            amount,
            paymentMode,
            paymentDate,
            note: paymentNote,
          };

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

      clearDealerCache(selectedDealerId);
      resetPaymentForm();
      await loadLedger(selectedDealerId, selectedMonth, { force: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save payment";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const onPrint = () => {
    const safe = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    const textOrDash = (value?: string) => {
      const next = (value || "").trim();
      return next || "-";
    };

    const rowsHtml = displayRows
      .map((row, idx) => {
        return `<tr>
          <td>${idx + 1}</td>
          <td>${safe(row.dateText)}</td>
          <td>${safe(row.entryText)}</td>
          <td>${safe(row.byText)}</td>
          <td>${safe(row.referenceText)}</td>
          <td style="text-align:right;">${safe(row.debitText)}</td>
          <td style="text-align:right;">${safe(row.creditText)}</td>
        </tr>`;
      })
      .join("");

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Purchase Ledger Print</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 16px; color: #0f172a; }
    .header h2 { margin: 0; font-size: 24px; }
    .header p { margin: 4px 0; font-size: 13px; color: #334155; }
    .meta { margin: 10px 0 14px; font-size: 13px; }
    .party-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; }
    .party-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; font-size: 12px; }
    .party-title { font-weight: 700; margin-bottom: 6px; color: #0f172a; }
    .line { margin: 2px 0; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
    .box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; }
    .box .label { font-size: 11px; color: #64748b; text-transform: uppercase; }
    .box .value { margin-top: 3px; font-size: 17px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px; vertical-align: top; }
    th { background: #f1f5f9; text-align: left; font-size: 11px; text-transform: uppercase; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h2>${safe(companyProfile.name)}</h2>
    <p>Purchase Credit / Debit Ledger</p>
  </div>
  <div class="meta"><b>Party:</b> ${safe(selectedDealerName)} | <b>Month:</b> ${safe(
      monthLabel
    )}</div>
  <div class="party-grid">
    <div class="party-box">
      <div class="party-title">Company Details</div>
      <div class="line"><b>Name:</b> ${safe(textOrDash(companyProfile.name))}</div>
      <div class="line"><b>Address:</b> ${safe(textOrDash(companyAddress))}</div>
      <div class="line"><b>Phone:</b> ${safe(textOrDash(companyProfile.phone))}</div>
      <div class="line"><b>GSTIN/UIN:</b> ${safe(textOrDash(companyProfile.gstin))}</div>
    </div>
    <div class="party-box">
      <div class="party-title">Supplier Details</div>
      <div class="line"><b>Name:</b> ${safe(textOrDash(selectedDealer?.name))}</div>
      <div class="line"><b>Address:</b> ${safe(textOrDash(selectedDealer?.address))}</div>
      <div class="line"><b>Phone:</b> ${safe(textOrDash(selectedDealer?.phone))}</div>
      <div class="line"><b>GSTIN/UIN:</b> ${safe(textOrDash(selectedDealer?.gstin))}</div>
    </div>
  </div>
  <div class="summary">
    <div class="box"><div class="label">Total Purchase</div><div class="value">${safe(
      currency.format(ledger.summary.totalPurchase || 0)
    )}</div></div>
    <div class="box"><div class="label">Total Paid</div><div class="value">${safe(
      currency.format(ledger.summary.totalPaid || 0)
    )}</div></div>
    <div class="box"><div class="label">Balance</div><div class="value">${safe(
      currency.format(Math.abs(ledger.summary.balance || 0))
    )}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>S.N.</th>
        <th>Date</th>
        <th>Entry</th>
        <th>By</th>
        <th>Reference</th>
        <th style="text-align:right;">Debit</th>
        <th style="text-align:right;">Credit</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || `<tr><td colspan="7" style="text-align:center;">No ledger data for selected month.</td></tr>`}
    </tbody>
  </table>
</body>
</html>`;

    const win = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 150);
  };

  const onDownloadPdf = useCallback(async () => {
    setPdfLoading(true);
    try {
      const [{ default: html2canvas }, { default: JsPdf }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const safe = (value: string) =>
        value
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      const textOrDash = (value?: string) => {
        const next = (value || "").trim();
        return next || "-";
      };

      const rowsHtml = displayRows
        .map((row, idx) => {
          return `<tr>
            <td>${idx + 1}</td>
            <td>${safe(row.dateText)}</td>
            <td>${safe(row.entryText)}</td>
            <td>${safe(row.byText)}</td>
            <td>${safe(row.referenceText)}</td>
            <td style="text-align:right;">${safe(row.debitText)}</td>
            <td style="text-align:right;">${safe(row.creditText)}</td>
          </tr>`;
        })
        .join("");

      const html = `<div style="font-family:Arial,sans-serif;padding:16px;color:#0f172a;background:#ffffff;">
        <h2 style="margin:0;font-size:24px;">${safe(companyProfile.name)}</h2>
        <p style="margin:4px 0 0;font-size:13px;color:#334155;">Purchase Credit / Debit Ledger</p>
        <p style="margin:10px 0 12px;font-size:13px;"><b>Party:</b> ${safe(
          selectedDealerName
        )} | <b>Month:</b> ${safe(monthLabel)}</p>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px;">
          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px;font-size:12px;">
            <div style="font-weight:700;margin-bottom:6px;">Company Details</div>
            <div style="margin:2px 0;"><b>Name:</b> ${safe(textOrDash(companyProfile.name))}</div>
            <div style="margin:2px 0;"><b>Address:</b> ${safe(textOrDash(companyAddress))}</div>
            <div style="margin:2px 0;"><b>Phone:</b> ${safe(textOrDash(companyProfile.phone))}</div>
            <div style="margin:2px 0;"><b>GSTIN/UIN:</b> ${safe(textOrDash(companyProfile.gstin))}</div>
          </div>
          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px;font-size:12px;">
            <div style="font-weight:700;margin-bottom:6px;">Supplier Details</div>
            <div style="margin:2px 0;"><b>Name:</b> ${safe(textOrDash(selectedDealer?.name))}</div>
            <div style="margin:2px 0;"><b>Address:</b> ${safe(textOrDash(selectedDealer?.address))}</div>
            <div style="margin:2px 0;"><b>Phone:</b> ${safe(textOrDash(selectedDealer?.phone))}</div>
            <div style="margin:2px 0;"><b>GSTIN/UIN:</b> ${safe(textOrDash(selectedDealer?.gstin))}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr>
              <th style="border:1px solid #cbd5e1;padding:6px;background:#f1f5f9;text-align:left;">S.N.</th>
              <th style="border:1px solid #cbd5e1;padding:6px;background:#f1f5f9;text-align:left;">Date</th>
              <th style="border:1px solid #cbd5e1;padding:6px;background:#f1f5f9;text-align:left;">Entry</th>
              <th style="border:1px solid #cbd5e1;padding:6px;background:#f1f5f9;text-align:left;">By</th>
              <th style="border:1px solid #cbd5e1;padding:6px;background:#f1f5f9;text-align:left;">Reference</th>
              <th style="border:1px solid #cbd5e1;padding:6px;background:#f1f5f9;text-align:right;">Debit</th>
              <th style="border:1px solid #cbd5e1;padding:6px;background:#f1f5f9;text-align:right;">Credit</th>
            </tr>
          </thead>
          <tbody>
            ${
              rowsHtml ||
              `<tr><td colspan="7" style="border:1px solid #cbd5e1;padding:8px;text-align:center;">No ledger data for selected month.</td></tr>`
            }
          </tbody>
        </table>
      </div>`;

      const temp = document.createElement("div");
      temp.style.position = "fixed";
      temp.style.left = "-10000px";
      temp.style.top = "0";
      temp.style.width = "900px";
      temp.style.background = "#fff";
      temp.innerHTML = html;
      document.body.appendChild(temp);

      const canvas = await html2canvas(temp, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      temp.remove();

      const imgData = canvas.toDataURL("image/png");
      const pdf = new JsPdf("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const safeMonth = selectedMonth.replace(/[^0-9-]/g, "");
      const safeDealer = selectedDealerName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
      pdf.save(`purchase-ledger-${safeDealer || "dealer"}-${safeMonth}.pdf`);
    } catch (e) {
      console.error("PDF generation failed", e);
    } finally {
      setPdfLoading(false);
    }
  }, [companyAddress, companyProfile.gstin, companyProfile.name, companyProfile.phone, displayRows, monthLabel, selectedDealer?.address, selectedDealer?.gstin, selectedDealer?.name, selectedDealer?.phone, selectedDealerName, selectedMonth]);

  const balanceText = useMemo(() => {
    const balance = Number(ledger.summary.balance || 0);
    if (balance === 0) return "Month settled: purchases and payments are balanced.";
    if (balance > 0)
      return `Outstanding payable: ${currency.format(
        balance
      )} remains payable to the dealer.`;
    return `Advance paid: ${currency.format(
      Math.abs(balance)
    )} has been paid in excess to the dealer.`;
  }, [ledger.summary.balance]);

  const previousBalanceText = useMemo(() => {
    const balance = Number(previousMonthSummary.balance || 0);
    if (balance === 0) return `${previousMonthLabel}: purchases and payments are balanced.`;
    if (balance > 0) return `${previousMonthLabel}: payable amount ${currency.format(balance)}.`;
    return `${previousMonthLabel}: advance amount ${currency.format(Math.abs(balance))}.`;
  }, [previousMonthSummary.balance, previousMonthLabel]);

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Admin</p>
            <h1 className="text-2xl font-bold text-slate-900">Purchase Credit / Debit Ledger</h1>
            <p className="text-sm text-slate-500">Dealer-wise monthly purchase vs payment tracking</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
              onClick={() => loadLedger(selectedDealerId, selectedMonth, { force: true })}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              disabled={ledger.entries.length === 0}
              onClick={() => setShowPrintPreview(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <Printer className="h-4 w-4" />
              Print
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

        <div className="grid gap-4 lg:grid-cols-4">
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
            <p
              className={`mt-1 text-xl font-bold ${
                ledger.summary.balance > 0 ? "text-rose-700" : "text-blue-700"
              }`}
            >
              {currency.format(Math.abs(ledger.summary.balance || 0))}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs uppercase tracking-wide text-slate-500">Last Month Balance</p>
            <p
              className={`mt-1 text-xl font-bold ${
                previousMonthSummary.balance > 0 ? "text-rose-700" : "text-blue-700"
              }`}
            >
              {previousLoading
                ? "Loading..."
                : currency.format(Math.abs(previousMonthSummary.balance || 0))}
            </p>
            <p className="mt-1 text-xs text-slate-500">{previousMonthLabel}</p>
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
          <LedgerTable rows={displayRows} loading={loading} allowEdit onEdit={startEdit} />
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-start gap-2 text-sm text-slate-700">
            <IndianRupee className="mt-0.5 h-4 w-4 text-slate-500" />
            <div>
              <p>{balanceText}</p>
              <p className="mt-1 text-xs text-slate-500">{previousBalanceText}</p>
            </div>
          </div>
          {error && <p className="mt-2 text-sm font-medium text-rose-600">{error}</p>}
        </div>
      </div>

      {showPrintPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-4">
          <div className="flex h-full max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-base font-bold text-slate-900">Print Preview</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPrintPreview(false)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  Close
                </button>
                <button
                  type="button"
                  onClick={onPrint}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
                <button
                  type="button"
                  disabled={pdfLoading}
                  onClick={onDownloadPdf}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  <Download className="h-4 w-4" />
                  {pdfLoading ? "Downloading..." : "Download PDF"}
                </button>
              </div>
            </div>

            <div className="overflow-auto bg-slate-100 p-4">
              <div className="mx-auto w-full max-w-5xl rounded-xl bg-white p-6 text-slate-900 shadow-sm">
                <div className="mb-4 border-b border-slate-200 pb-3">
                  <h2 className="text-2xl font-bold">{companyProfile.name}</h2>
                  <p className="text-sm text-slate-600">Purchase Credit / Debit Ledger</p>
                  <div className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
                    <p>
                      <span className="font-semibold">Party:</span> {selectedDealerName}
                    </p>
                    <p>
                      <span className="font-semibold">Month:</span> {monthLabel}
                    </p>
                  </div>
                </div>

                <div className="mb-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="font-semibold text-slate-900">Company Details</p>
                    <p className="mt-1 text-slate-700">
                      <span className="font-medium">Name:</span> {companyProfile.name || "-"}
                    </p>
                    <p className="text-slate-700">
                      <span className="font-medium">Address:</span> {companyAddress || "-"}
                    </p>
                    <p className="text-slate-700">
                      <span className="font-medium">Phone:</span> {companyProfile.phone || "-"}
                    </p>
                    <p className="text-slate-700">
                      <span className="font-medium">GSTIN/UIN:</span> {companyProfile.gstin || "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="font-semibold text-slate-900">Supplier Details</p>
                    <p className="mt-1 text-slate-700">
                      <span className="font-medium">Name:</span> {selectedDealer?.name || "-"}
                    </p>
                    <p className="text-slate-700">
                      <span className="font-medium">Address:</span> {selectedDealer?.address || "-"}
                    </p>
                    <p className="text-slate-700">
                      <span className="font-medium">Phone:</span> {selectedDealer?.phone || "-"}
                    </p>
                    <p className="text-slate-700">
                      <span className="font-medium">GSTIN/UIN:</span> {selectedDealer?.gstin || "-"}
                    </p>
                  </div>
                </div>

                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs uppercase text-slate-500">Total Purchase</p>
                    <p className="text-lg font-bold text-slate-900">
                      {currency.format(ledger.summary.totalPurchase || 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs uppercase text-slate-500">Total Paid</p>
                    <p className="text-lg font-bold text-emerald-700">
                      {currency.format(ledger.summary.totalPaid || 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs uppercase text-slate-500">Balance</p>
                    <p className="text-lg font-bold text-rose-700">
                      {currency.format(Math.abs(ledger.summary.balance || 0))}
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <LedgerTable rows={displayRows} loading={false} allowEdit={false} onEdit={startEdit} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

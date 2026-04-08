"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

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
    selected: { totalBilled: number; totalPaid: number; totalRemaining: number };
    allTime: { totalRemaining: number };
  };
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

type CompanyProfile = {
  name: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  gstin: string;
};

const formatMoney = (value: number) =>
  `Rs. ${Math.round(Math.max(0, value)).toLocaleString("en-IN")}`;

const safeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const textOrDash = (value?: string) => {
  const next = (value || "").trim();
  return next || "-";
};

export default function CustomerDetailsPreviewPage() {
  const { customerKey } = useParams<{ customerKey: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [company, setCompany] = useState<CompanyProfile>({
    name: "Company",
    addressLine1: "",
    addressLine2: "",
    phone: "",
    gstin: "",
  });

  const period = searchParams.get("period") || "thisMonth";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  const loadCompanyProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/company-profile", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setCompany({
        name: typeof json?.name === "string" && json.name.trim() ? json.name.trim() : "Company",
        addressLine1: typeof json?.addressLine1 === "string" ? json.addressLine1.trim() : "",
        addressLine2: typeof json?.addressLine2 === "string" ? json.addressLine2.trim() : "",
        phone: typeof json?.phone === "string" ? json.phone.trim() : "",
        gstin: typeof json?.gstin === "string" ? json.gstin.trim() : "",
      });
    } catch {
      // keep fallback
    }
  }, []);

  const loadLedger = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ period });
      if (period === "custom") {
        if (from) params.set("from", from);
        if (to) params.set("to", to);
      }
      const res = await fetch(
        `/api/customer-ledger/${encodeURIComponent(customerKey)}?${params.toString()}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load preview");
      }
      setData(json as LedgerResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load preview");
    } finally {
      setLoading(false);
    }
  }, [customerKey, from, period, to]);

  useEffect(() => {
    void Promise.all([loadLedger(), loadCompanyProfile()]);
  }, [loadCompanyProfile, loadLedger]);

  const title = useMemo(() => {
    if (!data) return "Customer";
    return data.customer.shopName || data.customer.name || "Customer";
  }, [data]);

  const periodLabel = useMemo(() => {
    if (period === "all") return "All Time";
    if (period === "thisMonth") return "This Month";
    if (period === "lastMonth") return "Last Month";
    if (period === "custom") {
      if (from && to) return `${from} to ${to}`;
      return "Custom";
    }
    return "This Month";
  }, [period, from, to]);

  const companyAddress = useMemo(
    () => [company.addressLine1, company.addressLine2].filter(Boolean).join(", "),
    [company.addressLine1, company.addressLine2]
  );

  const buildCustomerDocumentHtml = useCallback(() => {
    if (!data) return "";
    const rows = data.bills
      .map((bill, index) => {
        return `<tr>
          <td>${index + 1}</td>
          <td>${safeHtml(bill.invoiceNumber)}</td>
          <td>${safeHtml(
            bill.billDate ? new Date(bill.billDate).toLocaleDateString("en-IN") : "-"
          )}</td>
          <td style="text-align:right;">${safeHtml(formatMoney(bill.grandTotal))}</td>
          <td style="text-align:right;">${safeHtml(formatMoney(bill.amountCollected))}</td>
          <td style="text-align:right;color:#b91c1c;font-weight:700;">${safeHtml(
            formatMoney(bill.balanceAmount)
          )}</td>
        </tr>`;
      })
      .join("");

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Customer Report</title>
  <style>
    body { font-family: Arial, sans-serif; background:#fff; color:#111827; padding:14px; }
    .sheet { border:1px solid #111827; padding:10px; }
    .header { display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid #111827; padding-bottom:8px; }
    .title { font-size:20px; font-weight:700; margin:0; }
    .sub { margin:2px 0 0; font-size:12px; color:#374151; }
    .panel-grid { margin-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .panel { border:1px solid #cbd5e1; padding:8px; font-size:12px; }
    .panel h4 { margin:0 0 6px; font-size:12px; text-transform:uppercase; }
    .summary { margin-top:10px; display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
    .sum-box { border:1px solid #cbd5e1; padding:8px; }
    .sum-label { font-size:10px; text-transform:uppercase; color:#475569; }
    .sum-value { margin-top:2px; font-size:14px; font-weight:700; }
    table { width:100%; margin-top:10px; border-collapse:collapse; font-size:12px; }
    th, td { border:1px solid #cbd5e1; padding:6px; }
    th { background:#f1f5f9; text-transform:uppercase; font-size:10px; text-align:left; }
    @media print { body { padding:0; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <p class="title">${safeHtml(textOrDash(company.name))}</p>
        <p class="sub">Customer Outstanding Report</p>
        <p class="sub">Period: ${safeHtml(periodLabel)}</p>
      </div>
      <div style="text-align:right;font-size:12px;">
        <div><b>GSTIN:</b> ${safeHtml(textOrDash(company.gstin))}</div>
        <div><b>Phone:</b> ${safeHtml(textOrDash(company.phone))}</div>
        <div><b>Address:</b> ${safeHtml(textOrDash(companyAddress))}</div>
      </div>
    </div>
    <div class="panel-grid">
      <div class="panel">
        <h4>Customer Details</h4>
        <div><b>Name:</b> ${safeHtml(textOrDash(data.customer.name))}</div>
        <div><b>Shop:</b> ${safeHtml(textOrDash(data.customer.shopName))}</div>
        <div><b>Phone:</b> ${safeHtml(textOrDash(data.customer.phone))}</div>
        <div><b>Address:</b> ${safeHtml(textOrDash(data.customer.address))}</div>
      </div>
      <div class="panel">
        <h4>Report Snapshot</h4>
        <div><b>Selected Bill Total:</b> ${safeHtml(formatMoney(data.totals.selected.totalBilled))}</div>
        <div><b>Selected Paid:</b> ${safeHtml(formatMoney(data.totals.selected.totalPaid))}</div>
        <div><b>Selected Remaining:</b> ${safeHtml(formatMoney(data.totals.selected.totalRemaining))}</div>
        <div><b>All Time Remaining:</b> ${safeHtml(formatMoney(data.totals.allTime.totalRemaining))}</div>
      </div>
    </div>
    <div class="summary">
      <div class="sum-box"><div class="sum-label">Selected Bill Total</div><div class="sum-value">${safeHtml(
        formatMoney(data.totals.selected.totalBilled)
      )}</div></div>
      <div class="sum-box"><div class="sum-label">Selected Paid</div><div class="sum-value">${safeHtml(
        formatMoney(data.totals.selected.totalPaid)
      )}</div></div>
      <div class="sum-box"><div class="sum-label">Selected Remaining</div><div class="sum-value" style="color:#b91c1c;">${safeHtml(
        formatMoney(data.totals.selected.totalRemaining)
      )}</div></div>
      <div class="sum-box"><div class="sum-label">All Time Remaining</div><div class="sum-value" style="color:#b91c1c;">${safeHtml(
        formatMoney(data.totals.allTime.totalRemaining)
      )}</div></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>S.N.</th>
          <th>Invoice</th>
          <th>Date</th>
          <th style="text-align:right;">Bill</th>
          <th style="text-align:right;">Paid</th>
          <th style="text-align:right;">Remaining</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="6" style="text-align:center;">No bills found for selected filter.</td></tr>`}
      </tbody>
    </table>
  </div>
</body>
</html>`;
  }, [company.name, company.gstin, company.phone, companyAddress, data, periodLabel]);

  const handleDownloadPdf = useCallback(async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { default: JsPdf }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const temp = document.createElement("div");
      temp.style.position = "fixed";
      temp.style.left = "-10000px";
      temp.style.top = "0";
      temp.style.width = "900px";
      temp.style.background = "#fff";
      temp.innerHTML = buildCustomerDocumentHtml();
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

      const safeName = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
      pdf.save(`customer-ledger-${safeName || "customer"}-${period}.pdf`);
    } finally {
      setDownloading(false);
    }
  }, [buildCustomerDocumentHtml, data, period, title]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow-sm">Loading preview...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-rose-600">{error || "No preview data found"}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="print-page-root min-h-screen bg-slate-100 p-4 sm:p-6">
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 8mm;
          }
          .print-hide {
            display: none !important;
          }
          .print-page-root {
            min-height: auto !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .print-sheet {
            margin: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            break-inside: avoid;
          }
          body {
            background: #fff !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-5xl space-y-3">
        <div className="print-hide rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-lg font-bold text-slate-900">Customer Report Preview</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.back()}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Back
              </button>
              <button
                onClick={() => window.print()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Print
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-emerald-400"
              >
                {downloading ? "Downloading..." : "Download PDF"}
              </button>
            </div>
          </div>
        </div>

        <div className="print-sheet rounded-2xl border border-black bg-white p-4 text-slate-900 shadow-sm">
          <div className="flex items-start justify-between border-b border-black pb-3">
            <div>
              <h2 className="text-xl font-bold">{company.name}</h2>
              <p className="text-sm text-slate-700">Customer Outstanding Report</p>
              <p className="text-xs text-slate-600">Period: {periodLabel}</p>
            </div>
            <div className="text-right text-xs text-slate-700">
              <p>
                <span className="font-semibold">Phone:</span> {textOrDash(company.phone)}
              </p>
              <p>
                <span className="font-semibold">GSTIN:</span> {textOrDash(company.gstin)}
              </p>
              <p>
                <span className="font-semibold">Address:</span> {textOrDash(companyAddress)}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-black p-2 text-sm">
              <p className="text-xs font-bold uppercase text-slate-700">Customer Details</p>
              <p className="mt-1">
                <span className="font-semibold">Name:</span> {textOrDash(data.customer.name)}
              </p>
              <p>
                <span className="font-semibold">Shop:</span> {textOrDash(data.customer.shopName)}
              </p>
              <p>
                <span className="font-semibold">Phone:</span> {textOrDash(data.customer.phone)}
              </p>
              <p>
                <span className="font-semibold">Address:</span> {textOrDash(data.customer.address)}
              </p>
            </div>
            <div className="rounded-md border border-black p-2 text-sm">
              <p className="text-xs font-bold uppercase text-slate-700">Report Snapshot</p>
              <p className="mt-1">
                <span className="font-semibold">Selected Bill Total:</span>{" "}
                {formatMoney(data.totals.selected.totalBilled)}
              </p>
              <p>
                <span className="font-semibold">Selected Paid:</span>{" "}
                {formatMoney(data.totals.selected.totalPaid)}
              </p>
              <p>
                <span className="font-semibold">Selected Remaining:</span>{" "}
                {formatMoney(data.totals.selected.totalRemaining)}
              </p>
              <p>
                <span className="font-semibold">All Time Remaining:</span>{" "}
                {formatMoney(data.totals.allTime.totalRemaining)}
              </p>
            </div>
          </div>

          <div className="mt-3 overflow-hidden border border-black">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
                  <th className="border border-black px-2 py-2 text-left">S.N.</th>
                  <th className="border border-black px-2 py-2 text-left">Invoice</th>
                  <th className="border border-black px-2 py-2 text-left">Date</th>
                  <th className="border border-black px-2 py-2 text-right">Bill</th>
                  <th className="border border-black px-2 py-2 text-right">Paid</th>
                  <th className="border border-black px-2 py-2 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {data.bills.map((bill, index) => (
                  <tr key={bill.id}>
                    <td className="border border-black px-2 py-2">{index + 1}</td>
                    <td className="border border-black px-2 py-2">#{bill.invoiceNumber}</td>
                    <td className="border border-black px-2 py-2">
                      {bill.billDate ? new Date(bill.billDate).toLocaleDateString("en-IN") : "-"}
                    </td>
                    <td className="border border-black px-2 py-2 text-right">{formatMoney(bill.grandTotal)}</td>
                    <td className="border border-black px-2 py-2 text-right">{formatMoney(bill.amountCollected)}</td>
                    <td className="border border-black px-2 py-2 text-right font-semibold text-rose-700">
                      {formatMoney(bill.balanceAmount)}
                    </td>
                  </tr>
                ))}
                {data.bills.length === 0 && (
                  <tr>
                    <td colSpan={6} className="border border-black px-2 py-3 text-center text-slate-500">
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

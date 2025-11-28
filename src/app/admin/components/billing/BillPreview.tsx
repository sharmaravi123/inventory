// src/app/admin/components/billing/BillPreview.tsx
"use client";

import React from "react";
import { Bill } from "@/store/billingApi";
import { jsPDF } from "jspdf";

type BillPreviewProps = {
  bill?: Bill;
  onClose: () => void;
};

type BillLine = {
  productName: string;
  itemsPerBox: number;
  quantityBoxes: number;
  quantityLoose: number;
  totalItems: number;
  sellingPrice: number;
  taxPercent: number;
  lineTotal: number;
};

const COMPANY_NAME = "Akash Inventory";
const COMPANY_ADDRESS_LINE_1 = "Your Street Address";
const COMPANY_ADDRESS_LINE_2 = "Bhopal, Madhya Pradesh, 462001";
const COMPANY_PHONE = "+91-9876543210";

export default function BillPreview({ bill, onClose }: BillPreviewProps) {
  if (!bill) return null;

  const handlePrint = (): void => {
    window.print();
  };

  const handleDownload = (): void => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginLeft = 12;
    const marginRight = 12;
    const usableWidth = pageWidth - marginLeft - marginRight;
    let y = 12;
    const lineHeight = 6;

    const ensureSpace = (needed: number): void => {
      const pageHeight = doc.internal.pageSize.getHeight();
      if (y + needed > pageHeight - 12) {
        doc.addPage();
        y = 12;
      }
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("INVOICE", pageWidth / 2, y, { align: "center" });
    y += lineHeight + 2;

    doc.setFontSize(11);
    doc.text(COMPANY_NAME.toUpperCase(), pageWidth / 2, y, { align: "center" });
    y += lineHeight;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(COMPANY_ADDRESS_LINE_1, pageWidth / 2, y, { align: "center" });
    y += lineHeight;
    doc.text(COMPANY_ADDRESS_LINE_2, pageWidth / 2, y, { align: "center" });
    y += lineHeight;

    if (bill.companyGstNumber) {
      doc.setFont("helvetica", "bold");
      doc.text(`GSTIN: ${bill.companyGstNumber}`, pageWidth / 2, y, { align: "center" });
      y += lineHeight;
      doc.setFont("helvetica", "normal");
    }

    doc.text(`Contact: ${COMPANY_PHONE}`, pageWidth / 2, y, { align: "center" });
    y += lineHeight;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("High quality inventory & distribution solutions.", pageWidth / 2, y, { align: "center" });
    doc.setTextColor(0);
    y += lineHeight + 2;

    doc.setDrawColor(200);
    doc.line(marginLeft, y, pageWidth - marginRight, y);
    y += 4;

    ensureSpace(40);
    const leftX = marginLeft;
    const rightX = pageWidth / 2 + 4;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Bill To", leftX, y);
    doc.text("Invoice Details", rightX, y);
    doc.setFont("helvetica", "normal");
    y += lineHeight;

    doc.text(bill.customerInfo.name, leftX, y);
    doc.text(`Invoice No: ${bill.invoiceNumber}`, rightX, y);
    y += lineHeight;

    if (bill.customerInfo.shopName) {
      doc.text(bill.customerInfo.shopName, leftX, y);
      y += lineHeight;
    }

    doc.text(bill.customerInfo.phone, leftX, y);
    doc.text(`Order ID: ${bill._id}`, rightX, y);
    y += lineHeight;

    const addressText = bill.customerInfo.address || "";
    if (addressText) {
      const wrapped = doc.splitTextToSize(addressText, usableWidth / 2 - 4);
      wrapped.forEach((wrappedLine: string) => {
        doc.text(wrappedLine, leftX, y);
        y += lineHeight;
      });
    }

    doc.text(`Date: ${new Date(bill.billDate).toLocaleString("en-IN")}`, rightX, y);
    y += lineHeight;

    if (bill.customerInfo.gstNumber) {
      doc.text(`GST: ${bill.customerInfo.gstNumber}`, leftX, y);
      y += lineHeight;
    }

    doc.text(`Total Items: ${bill.totalItems}`, rightX, y);
    y += lineHeight + 2;

    ensureSpace(16);
    doc.setDrawColor(0);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");

    const colX = {
      item: marginLeft,
      perBox: marginLeft + 48,
      boxes: marginLeft + 78,
      loose: marginLeft + 98,
      qty: marginLeft + 116,
      rate: marginLeft + 140,
      gst: marginLeft + 165,
      amount: marginLeft + 185,
    };

    doc.text("Item", colX.item, y);
    doc.text("Per Box", colX.perBox, y, { align: "right" });
    doc.text("Boxes", colX.boxes, y, { align: "right" });
    doc.text("Loose", colX.loose, y, { align: "right" });
    doc.text("Qty", colX.qty, y, { align: "right" });
    doc.text("Rate", colX.rate, y, { align: "right" });
    doc.text("GST %", colX.gst, y, { align: "right" });
    doc.text("Amount", colX.amount, y, { align: "right" });

    y += lineHeight;
    doc.setFont("helvetica", "normal");
    doc.setDrawColor(200);
    doc.line(marginLeft, y, pageWidth - marginRight, y);
    y += 4;

    (bill.items ?? []).forEach((line: BillLine) => {
      ensureSpace(12);

      const itemNameLines = doc.splitTextToSize(line.productName ?? "Item", colX.perBox - colX.item - 6);
      const rowHeight = itemNameLines.length * lineHeight;

      itemNameLines.forEach((txt: string, i: number) => {
        doc.text(txt, colX.item, y + i * lineHeight);
      });

      doc.text(String(line.itemsPerBox ?? ""), colX.perBox, y, { align: "right" });
      doc.text(String(line.quantityBoxes ?? ""), colX.boxes, y, { align: "right" });
      doc.text(String(line.quantityLoose ?? ""), colX.loose, y, { align: "right" });
      doc.text(String(line.totalItems ?? ""), colX.qty, y, { align: "right" });
      doc.text(`₹${(line.sellingPrice ?? 0).toFixed(2)}`, colX.rate, y, { align: "right" });
      doc.text(`${(line.taxPercent ?? 0).toFixed(2)}%`, colX.gst, y, { align: "right" });
      doc.text(`₹${(line.lineTotal ?? 0).toFixed(2)}`, colX.amount, y, { align: "right" });

      y += rowHeight + 4;
    });

    y += 6;

    ensureSpace(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Payment Summary", marginLeft, y);
    y += lineHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const addRow = (label: string, value: string): void => {
      doc.text(label, marginLeft, y);
      doc.text(value, pageWidth - marginRight, y, { align: "right" });
      y += lineHeight;
    };

    addRow("Sub Total", `₹${(bill.totalBeforeTax ?? 0).toFixed(2)}`);
    addRow("Total Tax (GST)", `₹${(bill.totalTax ?? 0).toFixed(2)}`);

    doc.setFont("helvetica", "bold");
    addRow("Grand Total", `₹${(bill.grandTotal ?? 0).toFixed(2)}`);
    doc.setFont("helvetica", "normal");

    addRow("Paid", `₹${(bill.amountCollected ?? 0).toFixed(2)}`);
    addRow("Balance", `₹${(bill.balanceAmount ?? 0).toFixed(2)}`);

    y += 6;

    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.text("Notes", marginLeft, y);
    y += lineHeight;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    const notes: string[] = [
      "• Prices are inclusive of GST as applicable.",
      "• Goods once sold will be taken back or exchanged as per company policy.",
      "• This is a system generated invoice and does not require a physical signature.",
    ];

    notes.forEach((note: string) => {
      const lines = doc.splitTextToSize(note, usableWidth);
      lines.forEach((ln: string) => {
        ensureSpace(lineHeight);
        doc.text(ln, marginLeft, y);
        y += lineHeight;
      });
    });

    const pageHeight = doc.internal.pageSize.getHeight();
    const footerY = pageHeight - 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Thank you for your business!", pageWidth / 2, footerY, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      `We appreciate your trust in ${COMPANY_NAME}. For any queries, contact ${COMPANY_PHONE}.`,
      pageWidth / 2,
      footerY + 5,
      { align: "center", maxWidth: usableWidth }
    );

    doc.save(`invoice-${bill.invoiceNumber ?? "unnumbered"}.pdf`);
  };

  const handleShare = async (): Promise<void> => {
    const text = `Invoice ${bill.invoiceNumber}
Order ID: ${bill._id}
Customer: ${bill.customerInfo.name} (${bill.customerInfo.phone})
Total: ₹${(bill.grandTotal ?? 0).toFixed(2)}
Paid: ₹${(bill.amountCollected ?? 0).toFixed(2)}
Balance: ₹${(bill.balanceAmount ?? 0).toFixed(2)}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Invoice ${bill.invoiceNumber}`, text });
      } catch {
        // ignore
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      alert("Invoice summary copied to clipboard.");
    }
  };

  return (
    <>
      {/* GLOBAL print css – yahan se UI hide + sirf invoice print */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* sab kuch hide */
          body * {
            visibility: hidden !important;
          }

          /* sirf invoice root dikhana */
          .print-bill-root,
          .print-bill-root * {
            visibility: visible !important;
          }

          /* invoice ko normal flow me lao, top se start */
          .print-bill-root {
            position: static !important;
            inset: auto !important;
            display: block !important;
            height: auto !important;
            width: 100% !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            align-items: flex-start !important;
            justify-content: flex-start !important;
          }

          /* backdrop + buttons hide */
          .print-bill-backdrop,
          .print-bill-actions {
            display: none !important;
          }

          .print-bill-container {
            box-shadow: none !important;
            border-radius: 0 !important;
            border: 1px solid #e5e7eb !important;
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 16px !important;
          }

          table {
            page-break-inside: auto;
            border-collapse: collapse;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
        }
      `}</style>

      {/* Screen par modal, print ke time ye hi root as page banega */}
      <div className="print-bill-root fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 print:bg-transparent print:p-0">
        <div className="print-bill-backdrop absolute inset-0 bg-black/40" />
        <div className="print-bill-container relative w-full max-w-[820px] rounded-xl border border-slate-200 bg-white p-6 text-sm shadow-2xl">
          <header className="mb-4 border-b border-slate-300 pb-3">
            <h1 className="text-center text-xl font-bold tracking-wide text-slate-800">
              INVOICE
            </h1>
            <div className="mt-2 flex flex-col items-center text-center text-[11px] text-slate-700">
              <span className="text-sm font-semibold uppercase tracking-wide">
                {COMPANY_NAME}
              </span>
              <span>{COMPANY_ADDRESS_LINE_1}</span>
              <span>{COMPANY_ADDRESS_LINE_2}</span>
              {bill.companyGstNumber && (
                <span className="mt-1 font-medium">
                  GSTIN: {bill.companyGstNumber}
                </span>
              )}
              <span className="mt-1 text-[11px]">Contact: {COMPANY_PHONE}</span>
              <span className="mt-1 text-[10px] text-slate-500">
                High quality inventory & distribution solutions.
              </span>
            </div>
          </header>

          <section className="mb-4 grid gap-3 rounded-lg border border-slate-200 p-3 text-xs md:grid-cols-2">
            <div>
              <p className="mb-1 text-[11px] font-semibold text-slate-600">
                Bill To
              </p>
              <p className="text-sm font-semibold">
                {bill.customerInfo.name}
              </p>
              {bill.customerInfo.shopName && (
                <p className="text-[11px] text-slate-600">
                  {bill.customerInfo.shopName}
                </p>
              )}
              <p className="text-[11px] text-slate-600">
                {bill.customerInfo.phone}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {bill.customerInfo.address}
              </p>
              {bill.customerInfo.gstNumber && (
                <p className="mt-1 text-[11px] text-slate-500">
                  GST: {bill.customerInfo.gstNumber}
                </p>
              )}
            </div>
            <div className="md:text-right">
              <p className="mb-1 text-[11px] font-semibold text-slate-600">
                Invoice Details
              </p>
              <p className="text-[11px">
                Invoice No:{" "}
                <span className="font-semibold">
                  {bill.invoiceNumber}
                </span>
              </p>
              <p className="text-[11px]">
                Order ID:{" "}
                <span className="font-mono">
                  {bill._id}
                </span>
              </p>
              <p className="mt-1 text-[11px]">
                Date:{" "}
                {new Date(bill.billDate).toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                Total Items:{" "}
                <span className="font-semibold">
                  {bill.totalItems}
                </span>
              </p>
            </div>
          </section>

          <section className="mb-4 rounded-lg border border-slate-200">
            <table className="min-w-full border-collapse text-[11px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b px-2 py-1 text-left">
                    Item
                  </th>
                  <th className="border-b px-2 py-1 text-right">
                    Per Box
                  </th>
                  <th className="border-b px-2 py-1 text-right">
                    Boxes
                  </th>
                  <th className="border-b px-2 py-1 text-right">
                    Loose
                  </th>
                  <th className="border-b px-2 py-1 text-right">
                    Qty
                  </th>
                  <th className="border-b px-2 py-1 text-right">
                    Rate
                  </th>
                  <th className="border-b px-2 py-1 text-right">
                    GST %
                  </th>
                  <th className="border-b px-2 py-1 text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {(bill.items ?? []).map((line: BillLine, idx: number) => (
                  <tr key={`${line.productName ?? "item"}-${idx}`}>
                    <td className="border-b px-2 py-1 align-top">
                      {line.productName}
                    </td>
                    <td className="border-b px-2 py-1 text-right align-top">
                      {line.itemsPerBox}
                    </td>
                    <td className="border-b px-2 py-1 text-right align-top">
                      {line.quantityBoxes}
                    </td>
                    <td className="border-b px-2 py-1 text-right align-top">
                      {line.quantityLoose}
                    </td>
                    <td className="border-b px-2 py-1 text-right align-top">
                      {line.totalItems}
                    </td>
                    <td className="border-b px-2 py-1 text-right align-top">
                      ₹{(line.sellingPrice ?? 0).toFixed(2)}
                    </td>
                    <td className="border-b px-2 py-1 text-right align-top">
                      {(line.taxPercent ?? 0).toFixed(2)}%
                    </td>
                    <td className="border-b px-2 py-1 text-right align-top">
                      ₹{(line.lineTotal ?? 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mb-4 grid gap-3 text-xs md:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="mb-1 text-[11px] font-semibold text-slate-600">
                Payment Summary
              </p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Sub Total</span>
                  <span>₹{(bill.totalBeforeTax ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Tax (GST)</span>
                  <span>₹{(bill.totalTax ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-[color:var(--color-primary)]">
                  <span>Grand Total</span>
                  <span>₹{(bill.grandTotal ?? 0).toFixed(2)}</span>
                </div>
                <div className="mt-1 flex justify-between text-[11px]">
                  <span>Paid</span>
                  <span>₹{(bill.amountCollected ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Balance</span>
                  <span>₹{(bill.balanceAmount ?? 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-[11px]">
              <p className="mb-1 font-semibold text-slate-600">
                Notes
              </p>
              <p className="text-slate-600">
                • Prices are inclusive of GST as applicable.
              </p>
              <p className="text-slate-600">
                • Goods once sold will be taken back or exchanged as per company policy.
              </p>
              <p className="mt-2 text-[10px] text-slate-500">
                This is a system generated invoice and does not require a physical signature.
              </p>
            </div>
          </section>

          <footer className="mt-2 border-t border-slate-300 pt-2 text-center text-[11px] text-slate-600">
            <p className="font-semibold">
              Thank you for your business!
            </p>
            <p className="text-[10px] text-slate-500">
              We appreciate your trust in {COMPANY_NAME}. For queries contact {COMPANY_PHONE}.
            </p>
          </footer>

          <div className="print-bill-actions mt-4 flex flex-col gap-2 text-xs print:hidden">
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5"
              >
                Print
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5"
              >
                Download PDF
              </button>
              <button
                onClick={handleShare}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5"
              >
                Share
              </button>
            </div>
            <button
              onClick={onClose}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

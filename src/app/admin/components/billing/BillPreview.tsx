"use client";

import React, { useEffect, useMemo } from "react";
import { Bill, BillItemForClient } from "@/store/billingApi";

type BillPreviewProps = {
  bill?: Bill;
  onClose: () => void;
};

const COMPANY_NAME = "Akash Inventory";
const COMPANY_ADDRESS_LINE_1 = "H NO. 240, Some Street";
const COMPANY_ADDRESS_LINE_2 = "Bhopal, Madhya Pradesh, 462001";
const COMPANY_PHONE = "+91-9876543210";
const COMPANY_BANK_NAME = "HDFC Bank, HAMIDIA ROAD";
const COMPANY_ACCOUNT_NAME = "Aarif Singh";
const COMPANY_IFSC = "HDFC0000400";
const COMPANY_ACCOUNT_NO = "5020004980XXX";

type EnhancedLine = BillItemForClient & {
  totalPieces: number;
  discountAmount: number;
};

function numberToINRWords(amount: number): string {
  const rupees = Math.round(amount);
  if (!Number.isFinite(rupees) || rupees <= 0) return "Zero rupees only";

  const a = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const b = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];

  const two = (n: number) =>
    n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
  const three = (n: number) =>
    Math.floor(n / 100)
      ? a[Math.floor(n / 100)] +
      " hundred" +
      (n % 100 ? " " + two(n % 100) : "")
      : two(n);

  let num = rupees;
  let str = "";

  if (num >= 10000000) {
    str += three(Math.floor(num / 10000000)) + " crore ";
    num %= 10000000;
  }
  if (num >= 100000) {
    str += three(Math.floor(num / 100000)) + " lakh ";
    num %= 100000;
  }
  if (num >= 1000) {
    str += three(Math.floor(num / 1000)) + " thousand ";
    num %= 1000;
  }
  if (num > 0) str += three(num);

  return str.trim().replace(/^./, (c) => c.toUpperCase()) + " rupees only";
}

export default function BillPreview({ bill, onClose }: BillPreviewProps) {
  /* -------------------- ESC KEY -------------------- */
  useEffect(() => {
    if (!bill) return;

    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [bill, onClose]);

  /* -------------------- LINES -------------------- */
  const lines: EnhancedLine[] = useMemo(() => {
    if (!bill) return [];

    return bill.items.map((l) => {
      const totalPieces =
        (l.quantityBoxes ?? 0) * (l.itemsPerBox ?? 1) +
        (l.quantityLoose ?? 0);

      const baseAmount = totalPieces * (l.sellingPrice ?? 0);
      const finalAmount = l.lineTotal ?? baseAmount;

      return {
        ...l,
        totalPieces,
        discountAmount: Math.max(baseAmount - finalAmount, 0),
      };
    });
  }, [bill]);


  /* -------------------- GUARD -------------------- */
  if (!bill) return null;

  const lineDiscountTotal = lines.reduce(
    (sum, l) => sum + l.discountAmount,
    0
  );
  // const billLevelDiscount = bill.overallDiscount ?? 0;

  const discountTotal = lines.reduce(
    (sum, l) => sum + l.discountAmount,
    0
  );

  const cgst = (bill.totalTax ?? 0) / 2;
  const sgst = (bill.totalTax ?? 0) / 2;

  const handlePrint = () => window.print();

  const handleDownload = async () => {
    if (typeof window === "undefined") return;

    const el = document.querySelector(".print-bill-root") as HTMLElement | null;
    if (!el) return;

    const html2pdf = (await import("html2pdf.js")).default;

    html2pdf()
      .set({
        margin: 10,
        filename: `invoice-${bill.invoiceNumber}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(el)
      .save();
  };
  return (
    <>
      {/* 🔒 PRINT = PREVIEW */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          body {
            margin: 0;
            padding: 0;
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print-only-hide {
            display: none !important;
          }

          .print-bill-root {
            box-shadow: none !important;
            border-radius: 0 !important;
            background: #fff !important;
          }
        }
      `}</style>

      {/* MODAL */}
      <div className="fixed inset-0 z-50 bg-black/40 p-4 print-only-hide">
        <div className="mx-auto mt-6 w-full max-w-5xl bg-white p-4 text-xs">
          {/* ACTION BAR */}
          <div className="mb-2 flex justify-between">
            <b>Invoice Preview</b>
            <div className="flex gap-2">
              <button onClick={handlePrint} className="border px-3 py-1">
                Print
              </button>
              <button onClick={handleDownload} className="border px-3 py-1">
                Download PDF
              </button>
              <button onClick={onClose} className="border px-3 py-1">
                Close
              </button>
            </div>
          </div>

          {/* ================= INVOICE ================= */}
          <div className="print-bill-root border border-black p-3">
            {/* HEADER */}
            <div className="border-b border-black pb-2">
              <div className="flex justify-between">
                <div>
                  <div className="font-bold uppercase">Tax Invoice</div>
                  <div className="font-bold text-lg">{COMPANY_NAME}</div>
                  <div>{COMPANY_ADDRESS_LINE_1}</div>
                  <div>{COMPANY_ADDRESS_LINE_2}</div>
                  <div>GSTIN: {bill.companyGstNumber}</div>
                  <div>Mobile: {COMPANY_PHONE}</div>
                </div>
                <div className="text-right">
                  <div>Invoice No: {bill.invoiceNumber}</div>
                  <div>
                    Date:{" "}
                    {new Date(bill.billDate).toLocaleDateString("en-IN")}
                  </div>
                </div>
              </div>
            </div>

            {/* BILL TO */}
            <div className="mt-2 grid grid-cols-2 border border-black">
              <div className="border-r border-black p-2">
                <b>BILL TO</b>
                <div>{bill.customerInfo.name}</div>
                <div>{bill.customerInfo.address}</div>
                <div>Mobile: {bill.customerInfo.phone}</div>
                {bill.customerInfo.gstNumber && (
                  <div>GSTIN: {bill.customerInfo.gstNumber}</div>
                )}
              </div>
              <div className="p-2">
                <b>SHIP TO</b>
                <div>{bill.customerInfo.name}</div>
                <div>{bill.customerInfo.address}</div>
              </div>
            </div>

            {/* ITEMS */}
            <table className="mt-2 w-full border-collapse border border-black">
              <thead>
                <tr>
                  {[
                    "S.N.",
                    "ITEMS",
                    "HSN",
                    "QTY",
                    "RATE",
                    "DISC.",
                    "AMOUNT",
                  ].map((h) => (
                    <th
                      key={h}
                      className="border border-black p-1 text-left"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="border border-black p-1">{i + 1}</td>
                    <td className="border border-black p-1">
                      {l.productName}
                    </td>
                    <td className="border border-black p-1">
                      {l.hsnCode ?? "-"}
                    </td>
                    <td className="border border-black p-1">
                      {l.quantityBoxes ?? 0} box /{" "}
                      {l.quantityLoose ?? 0} loose
                      <div className="text-[10px] text-slate-600">
                        ({l.totalPieces} pcs)
                      </div>
                    </td>

                    <td className="border border-black p-1">
                      {l.sellingPrice?.toFixed(2)}
                    </td>
                    <td className="border border-black p-1">
                      {l.discountAmount.toFixed(2)}
                    </td>
                    <td className="border border-black p-1">
                      {l.lineTotal?.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* TOTALS */}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="border border-black p-2">
                <b>Total Amount (in words)</b>
                <div>{numberToINRWords(bill.grandTotal ?? 0)}</div>
              </div>
              <div className="border border-black p-2">
                <div className="flex justify-between">
                  <span>Sub Total</span>
                  <span>{bill.totalBeforeTax?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span>{discountTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>CGST</span>
                  <span>{cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST</span>
                  <span>{sgst.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-black pt-1 font-bold">
                  <span>Grand Total</span>
                  <span>{bill.grandTotal?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* BANK */}
            <div className="mt-2 grid grid-cols-2 border border-black">
              <div className="border-r border-black p-2">
                <b>Bank Details</b>
                <div>Name: {COMPANY_ACCOUNT_NAME}</div>
                <div>A/C No: {COMPANY_ACCOUNT_NO}</div>
                <div>IFSC: {COMPANY_IFSC}</div>
                <div>Bank: {COMPANY_BANK_NAME}</div>
              </div>
              <div className="p-2">
                <b>Terms & Conditions</b>
                <div>1. Goods once sold will not be taken back.</div>
                <div>2. Subject to local jurisdiction.</div>
              </div>
            </div>

            <div className="mt-2 text-center">
              This is a computer generated invoice.
            </div>
          </div>
          {/* ============== END INVOICE ============== */}
        </div>
      </div>
    </>
  );
}

"use client";

import React, { useEffect, useMemo } from "react";
import { Bill, BillItemForClient } from "@/store/billingApi";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { fetchProducts, ProductType } from "@/store/productSlice";
import { useRouter } from "next/navigation";

type BillPreviewProps = {
  bill?: Bill;
  onClose: () => void;
};

/* ================== CONSTANTS ================== */

const COMPANY_NAME = "JMK TRADERS";
const COMPANY_ADDRESS_LINE_1 = `
NO 240, SANUEEY NAGAR COLONY, SANJEEV NACAR, NEVARI BADVAI,
Acharpua Industrial Area.
`;
const COMPANY_ADDRESS_LINE_2 = "Bhopal, Madhya Pradesh, 462018";
const COMPANY_PHONE = "+91-9876543210";
const COMPANY_BANK_NAME = "HDFC Bank, HAMIDIA ROAD";
const COMPANY_ACCOUNT_NAME = "Aarif Singh";
const COMPANY_IFSC = "HDFC0000400";
const COMPANY_ACCOUNT_NO = "5020004980XXX";

/* ================== TYPES ================== */

type EnhancedLine = BillItemForClient & {
  totalPieces: number;
  discountAmount: number;
};

/* ================== UTILS ================== */

function extractProductId(
  product: string | { _id?: string } | undefined
): string | undefined {
  if (!product) return undefined;

  if (typeof product === "string") return product;

  if (typeof product === "object" && product._id) {
    return product._id;
  }

  return undefined;
}

function numberToINRWords(amount: number): string {
  const rupees = Math.round(amount);
  if (!Number.isFinite(rupees) || rupees <= 0) return "Zero rupees only";

  const a = [
    "",
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
    "sixteen", "seventeen", "eighteen", "nineteen",
  ];
  const b = [
    "", "",
    "twenty", "thirty", "forty", "fifty",
    "sixty", "seventy", "eighty", "ninety",
  ];

  const two = (n: number) =>
    n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");

  const three = (n: number) =>
    Math.floor(n / 100)
      ? a[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + two(n % 100) : "")
      : two(n);

  let num = rupees;
  let str = "";

  if (num >= 10000000) { str += three(Math.floor(num / 10000000)) + " crore "; num %= 10000000; }
  if (num >= 100000) { str += three(Math.floor(num / 100000)) + " lakh "; num %= 100000; }
  if (num >= 1000) { str += three(Math.floor(num / 1000)) + " thousand "; num %= 1000; }
  if (num > 0) str += three(num);

  return str.trim().replace(/^./, c => c.toUpperCase()) + " rupees only";
}

/* ================== COMPONENT ================== */

export default function BillPreview({ bill, onClose }: BillPreviewProps) {
  const dispatch = useAppDispatch();

  /* 🔹 PRODUCTS — MUST BE FIRST */
  const products = useAppSelector(
    (state) => state.product.products as ProductType[]
  );

  /* 🔹 ENSURE PRODUCTS ARE LOADED */
  useEffect(() => {
    if (products.length === 0) {
      dispatch(fetchProducts());
    }
  }, [products.length, dispatch]);

  /* 🔹 ESC KEY */
  useEffect(() => {
    if (!bill) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [bill, onClose]);

  /* 🔹 HSN RESOLVER */
  const getHsnCode = (
    product: string | { _id?: string } | undefined
  ): string => {
    const productId = extractProductId(product);
    if (!productId) return "-";

    const found = products.find(
      (p) => p._id === productId || p.id === productId
    );

    return found?.hsnCode ?? "-";
  };

  /* 🔹 BILL LINES */
  const lines: EnhancedLine[] = useMemo(() => {
    if (!bill) return [];

    return bill.items.map((l) => {
      const totalPieces =
        (l.quantityBoxes ?? 0) * (l.itemsPerBox ?? 1) +
        (l.quantityLoose ?? 0);

      const base = totalPieces * (l.sellingPrice ?? 0);

      let discount = 0;
      if (l.discountType === "PERCENT") {
        discount = (base * (l.discountValue ?? 0)) / 100;
      } else if (l.discountType === "CASH") {
        discount = l.discountValue ?? 0;
      }

      discount = Math.min(discount, base);

      return {
        ...l,
        totalPieces,
        discountAmount: discount,
        lineTotal: base - discount,
      };
    });
  }, [bill]);

  if (!bill) return null;

  const discountTotal = lines.reduce((s, l) => s + l.discountAmount, 0);
  const cgst = (bill.totalTax ?? 0) / 2;
  const sgst = (bill.totalTax ?? 0) / 2;

  const handlePrint = () => window.print();
  const router = useRouter();


  return (
    <>
      {/* 🔒 PRINT = PREVIEW */}
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
            background: white;
          }
          .print-only-hide {
      display: none !important;
    }
          .print-bill-root {
            width: 100%;
            page-break-inside: avoid;
          }
        }
      `}</style>


      {/* MODAL */}
      <div className="mx-auto mt-6 w-full max-w-5xl bg-white p-4 text-xs">
        {/* ACTION BAR */}
        <div className="mb-2 flex justify-between print-only-hide">
          <b>Invoice Preview</b>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-white font-medium shadow hover:bg-blue-700 transition"
            >
              🖨 Print
            </button>

            {/* <button
              onClick={handleDownload}
              className="rounded-md bg-green-600 px-4 py-1.5 text-white font-medium shadow hover:bg-green-700 transition"
            >
              ⬇ Download PDF
            </button> */}

            <button
              onClick={() => router.back()}
              className="rounded-md bg-red-600 px-4 py-1.5 text-white font-medium shadow hover:bg-red-700 transition"
            >
              ✖ Close
            </button>

          </div>
        </div>


        {/* ================= INVOICE ================= */}
        <div className="print-bill-root border border-black p-3">
          {/* HEADER */}
          <div className="border-b border-black pb-2">
            <div className="flex justify-between">
              <div>
                <div className="flex">

                  <div className="font-bold uppercase">Tax Invoice</div>
                  <div className="font-bold uppercase mx-2 border">ORIGINAL FOR RECIPIENT</div>
                </div>

                <div className="font-bold text-lg" >{COMPANY_NAME}</div>
                <div style={{ whiteSpace: "pre-line" }}>{COMPANY_ADDRESS_LINE_1}</div>
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
              <div>{bill.customerInfo.shopName}</div>
              <div>Address : {bill.customerInfo.address}</div>
              <div>Mobile: {bill.customerInfo.phone}</div>
              {bill.customerInfo.gstNumber && (
                <div>GSTIN: {bill.customerInfo.gstNumber}</div>
              )}
            </div>
            <div className="p-2">
              <b>SHIP TO</b>
              <div>{bill.customerInfo.shopName}</div>
              <div>Address : {bill.customerInfo.address}</div>
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
                  "TAX %",
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
                    {getHsnCode(l.product)}
                  </td>

                  <td className="border border-black p-1">
                    {l.quantityBoxes > 0 && l.quantityLoose > 0 && (
                      <>
                        {l.quantityBoxes} box / {l.quantityLoose} loose
                      </>
                    )}

                    {l.quantityBoxes > 0 && l.quantityLoose === 0 && (
                      <>
                        {l.quantityBoxes} box
                      </>
                    )}

                    {l.quantityLoose > 0 && l.quantityBoxes === 0 && (
                      <>
                        {l.quantityLoose} loose
                      </>
                    )}

                    {/* <div className="text-[10px] text-slate-600">
                      ({l.totalPieces} pcs)
                    </div> */}
                  </td>


                  <td className="border border-black p-1">
                    {l.sellingPrice?.toFixed(2)}
                  </td>
                  <td className="border border-black p-1">
                    {l.taxPercent?.toFixed(2)}%
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
    </>
  );
}

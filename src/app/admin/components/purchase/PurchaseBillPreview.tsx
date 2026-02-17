"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCompanyProfile } from "@/store/companyProfileSlice";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useRef } from "react";
import Swal from "sweetalert2";

/* ================== TYPES ================== */

type PurchaseItem = {
    productName: string;
    hsn?: string;
    boxes: number;
    looseItems: number;
    perBoxItem: number;
    purchasePrice: number;
    discountPercent?: number;
    discountAmount?: number;
    grossAmount?: number;
    taxableAmount?: number;
    taxPercent: number;
    taxAmount?: number;
    lineAmount?: number;
};

type PurchaseBill = {
    invoiceNumber: string;
    purchaseDate: string;

    dealer: {
        name: string;
        phone?: string;
        address?: string;
        gstin?: string;
    };

    warehouse?: {
        name: string;
    };

    items: PurchaseItem[];

    totalGross?: number;
    totalDiscountAmount?: number;
    totalDiscountPercent?: number;
    totalBeforeTax: number;
    totalTax: number;
    grandTotal: number;
};

/* ================== UTILS ================== */

function numberToINRWords(amount: number): string {
    const rupees = Math.round(amount);
    if (!Number.isFinite(rupees) || rupees <= 0) return "Zero rupees only";

    const a = [
        "",
        "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
        "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
        "sixteen", "seventeen", "eighteen", "nineteen",
    ];
    const b = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

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

export default function PurchaseBillPreview({
    bill,
    onClose,
}: {
    bill?: PurchaseBill;
    onClose: () => void;
}) {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const companyProfile = useAppSelector(
        (state) => state.companyProfile.data
    );
    const invoiceRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!companyProfile) {
            dispatch(fetchCompanyProfile());
        }
    }, [companyProfile, dispatch]);

    const company = useMemo(() => {
        return {
            name: companyProfile?.name || "—",
            addressLine1: companyProfile?.addressLine1 || "",
            addressLine2: companyProfile?.addressLine2 || "",
            phone: companyProfile?.phone || "",
            gstin: companyProfile?.gstin || "",
            bankName: companyProfile?.bankName || "",
            accountHolder: companyProfile?.accountHolder || "",
            accountNumber: companyProfile?.accountNumber || "",
            ifsc: companyProfile?.ifscCode || "",
            branch: companyProfile?.branch || "",
        };
    }, [companyProfile]);
    useEffect(() => {
        const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", esc);
        return () => window.removeEventListener("keydown", esc);
    }, [onClose]);

    if (!bill) return null;
    const subtotalWithoutTax = bill.totalBeforeTax;
    const totalGross = bill.totalGross ?? bill.items.reduce((s, it) => {
        const qty = it.boxes * it.perBoxItem + it.looseItems;
        return s + qty * it.purchasePrice;
    }, 0);
    const totalDiscountAmount = bill.totalDiscountAmount ?? bill.items.reduce((s, it) => s + Number(it.discountAmount ?? 0), 0);
    const totalDiscountPercent = bill.totalDiscountPercent ?? (totalGross > 0 ? (totalDiscountAmount * 100) / totalGross : 0);

    const cgst = bill.totalTax / 2;
    const sgst = bill.totalTax / 2;

    const handlePrint = () => window.print();
    const generatePDF = async () => {
        if (!invoiceRef.current) return;

        const canvas = await html2canvas(invoiceRef.current, {
            scale: 2,
            useCORS: true,
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

        return pdf;
    };
    const handleDownloadAndShare = async () => {
        const pdf = await generatePDF();
        if (!pdf) return;

        const fileName = `Purchase-Invoice-${bill?.invoiceNumber}.pdf`;

        // Download
        pdf.save(fileName);

        // Share (mobile / supported browsers)
        const blob = pdf.output("blob");
        const file = new File([blob], fileName, {
            type: "application/pdf",
        });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    title: "Purchase Invoice",
                    text: "Purchase invoice PDF",
                    files: [file],
                });
            } catch {
                // user cancelled share – ignore
            }
        }
    };

    const handleSharePDF = async () => {
        const pdf = await generatePDF();
        if (!pdf) return;

        const fileName = `Purchase-Invoice-${bill?.invoiceNumber}.pdf`;
        const blob = pdf.output("blob");

        const file = new File([blob], fileName, {
            type: "application/pdf",
        });

        // ✅ Mobile / supported browsers
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    title: "Purchase Invoice",
                    text: "Purchase invoice PDF",
                    files: [file],
                });
            } catch {
                // user cancelled → ignore
            }
        } else {
            // ❌ Desktop fallback
             Swal.fire({
                    icon: "success",
                    title: "Share",
                    text: "Sharing is supported on mobile devices. Please use Download on desktop.",
                    confirmButtonText: "OK",
                  });
        }
    };


    return (
        <>
            {/* PRINT STYLE */}
            <style jsx global>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          .print-hide { display: none !important; }
        }
      `}</style>

            <div className="mx-auto mt-6 max-w-5xl bg-white p-4 text-xs">
                {/* ACTION BAR */}
                <div className="mb-2 flex justify-between print-hide">
                    <b>Purchase Invoice Preview</b>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="bg-blue-600 px-4 py-1.5 text-white rounded">
                            🖨 Print
                        </button>
                        <button
                            onClick={handleDownloadAndShare}
                            className="bg-green-600 px-4 py-1.5 text-white rounded"
                        >
                            ⬇ PDF
                        </button>
                        <button
                            onClick={handleSharePDF}
                            className="bg-indigo-600 px-4 py-1.5 text-white rounded"
                        >
                            🔗 Share PDF
                        </button>
                        <button onClick={() => router.back()} className="bg-red-600 px-4 py-1.5 text-white rounded">
                            ✖ Close
                        </button>
                    </div>
                </div>

                {/* INVOICE */}
                <div ref={invoiceRef} className="border border-black p-3">
                    {/* HEADER */}
                    <div className="border-b border-black pb-2 flex justify-between">
                        <div>
                            <div className="flex gap-2 font-bold uppercase">
                                <span>Tax Invoice</span>
                            </div>
                            <div className="text-lg font-bold">{company.name}</div>
                            <div style={{ whiteSpace: "pre-line" }}>{company.addressLine1}</div>
                            <div>{company.addressLine2}</div>
                            <div>Mobile: {company.phone}</div>
                        </div>

                        <div className="text-right">
                            <div>Invoice No: {bill.invoiceNumber}</div>
                            <div>Date: {new Date(bill.purchaseDate).toLocaleDateString("en-IN")}</div>
                        </div>
                    </div>

                    {/* DEALER */}
                    <div className="mt-2 grid grid-cols-2 border border-black">
                        <div className="border-r border-black p-2">
                            <b>BILL FROM (DEALER)</b>
                            <div>{bill.dealer.name}</div>
                            <div>Address : {bill.dealer.address}</div>
                            <div>Mobile: {bill.dealer.phone}</div>
                            {bill.dealer.gstin && <div>GSTIN: {bill.dealer.gstin}</div>}
                        </div>
                        <div className="p-2">
                            <b>Store</b>
                            <div>{bill.warehouse?.name}</div>
                        </div>
                    </div>

                    {/* ITEMS */}
                    <table className="mt-2 w-full border border-black border-collapse">
                        <thead>
                            <tr>
                                {["S.N.", "ITEMS", "HSN", "QTY", "RATE", "DISC %", "DISC AMT", "TAX %", "AMOUNT"].map(h => (
                                    <th key={h} className="border border-black p-1 text-left">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {bill.items.map((it, i) => {
                                const totalPieces = it.boxes * it.perBoxItem + it.looseItems;
                                const grossAmount = typeof it.grossAmount === "number"
                                    ? it.grossAmount
                                    : totalPieces * it.purchasePrice;
                                const discountPercent = Number(it.discountPercent ?? 0);
                                const discountAmount = typeof it.discountAmount === "number"
                                    ? it.discountAmount
                                    : (grossAmount * discountPercent) / 100;
                                const taxableAmount = typeof it.taxableAmount === "number"
                                    ? it.taxableAmount
                                    : Math.max(0, grossAmount - discountAmount);
                                const taxAmount = typeof it.taxAmount === "number"
                                    ? it.taxAmount
                                    : (taxableAmount * Number(it.taxPercent || 0)) / 100;
                                const lineAmount = typeof it.lineAmount === "number"
                                    ? it.lineAmount
                                    : taxableAmount + taxAmount;

                                return (
                                    <tr key={i}>
                                        <td className="border p-1">{i + 1}</td>
                                        <td className="border p-1">{it.productName}</td>
                                        <td className="border p-1">{it.hsn || "-"}</td>
                                        <td className="border p-1">
                                            {it.boxes > 0 && `${it.boxes} box `}
                                            {it.looseItems > 0 && `${it.looseItems} loose`}
                                            <div className="text-[10px]">({totalPieces} pcs)</div>
                                        </td>
                                        <td className="border p-1">{it.purchasePrice.toFixed(2)}</td>
                                        <td className="border p-1">{discountPercent.toFixed(2)}%</td>
                                        <td className="border p-1">{discountAmount.toFixed(2)}</td>
                                        <td className="border p-1">{it.taxPercent}%</td>
                                        <td className="border p-1">{lineAmount.toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* TOTALS */}
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="border p-2">
                            <b>Total Amount (in words)</b>
                            <div>{numberToINRWords(bill.grandTotal)}</div>
                        </div>
                        <div className="border p-2">
                            <div className="flex justify-between"><span>Gross Total</span><span>{totalGross.toFixed(2)}</span></div>
                            {/* <div className="flex justify-between"><span>Total Discount %</span><span>{totalDiscountPercent.toFixed(2)}%</span></div> */}
                            <div className="flex justify-between"><span>Total Discount</span><span>{totalDiscountAmount.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>Sub Total</span><span>{subtotalWithoutTax.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>CGST</span><span>{cgst.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>SGST</span><span>{sgst.toFixed(2)}</span></div>
                            <div className="flex justify-between border-t border-black font-bold pt-1">
                                <span>Grand Total</span>
                                <span>{bill.grandTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* BANK */}
                    <div className="mt-2 grid grid-cols-2 border border-black">
                        <div className="border-r border-black p-2">
                            <b>Bank Details</b>
                            <div>Name: {company.accountHolder}</div>
                            <div>A/C No: {company.accountNumber}</div>
                            <div>IFSC: {company.ifsc}</div>
                            <div>
                                Bank: {company.bankName}
                                {company.branch && `, ${company.branch}`}
                            </div>
                        </div>
                        <div className="p-2">
                            <b>Terms & Conditions</b>
                            <div>1. Goods once purchased will not be returned.</div>
                            <div>2. Subject to local jurisdiction.</div>
                        </div>
                    </div>

                    <div className="mt-2 text-center">
                        This is a computer generated purchase invoice.
                    </div>
                </div>
            </div>
        </>
    );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PurchaseBillPreview from "@/app/admin/components/purchase/PurchaseBillPreview";

export default function PrintPurchaseBillPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [bill, setBill] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const loadPurchase = async () => {
      try {
        const res = await fetch(`/api/purchase/${id}`, {
  cache: "no-store",
  credentials: "include",
});


        if (!res.ok) {
          setError("Purchase not found");
          return;
        }

        const data = await res.json();

        /* ===============================
           MAP ITEMS
        =============================== */

        const items = data.items.map((it: any) => {
          const perBox = it.productId?.perBoxItem ?? 1;
          const totalPieces = it.boxes * perBox + it.looseItems;
          const grossAmount = totalPieces * it.purchasePrice;
          const discountPercent = Number(it.discountPercent ?? 0);
          const discountAmount = typeof it.discountAmount === "number"
            ? it.discountAmount
            : (grossAmount * discountPercent) / 100;
          const taxableAmount = Math.max(0, grossAmount - discountAmount);
          const taxAmount = typeof it.taxAmount === "number"
            ? it.taxAmount
            : (taxableAmount * Number(it.taxPercent ?? 0)) / 100;
          const lineAmount = typeof it.totalAmount === "number"
            ? it.totalAmount
            : taxableAmount + taxAmount;

          return {
            productName: it.productId?.name ?? "N/A",
            hsn: it.productId?.hsnCode ?? "-",
            boxes: it.boxes,
            looseItems: it.looseItems,
            perBoxItem: perBox,
            purchasePrice: it.purchasePrice,
            discountPercent,
            discountAmount,
            taxPercent: it.taxPercent,
            taxAmount,
            grossAmount,
            taxableAmount,
            lineAmount,
          };
        });

        /* ===============================
           TOTALS
        =============================== */

        const totalGross = items.reduce(
          (sum: number, it: any) => sum + it.grossAmount,
          0
        );

        const totalDiscountAmount = items.reduce(
          (sum: number, it: any) => sum + it.discountAmount,
          0
        );

        const totalBeforeTax = items.reduce(
          (sum: number, it: any) => sum + it.taxableAmount,
          0
        );

        const totalTax = items.reduce((sum: number, it: any) => sum + it.taxAmount, 0);

        const grandTotal = items.reduce((sum: number, it: any) => sum + it.lineAmount, 0);
        const totalDiscountPercent =
          totalGross > 0 ? (totalDiscountAmount * 100) / totalGross : 0;

        /* ===============================
           FINAL BILL
        =============================== */

        setBill({
          invoiceNumber: data.invoiceNumber || data.purchaseNumber || "-",
          purchaseDate: data.purchaseDate ?? data.createdAt,

          dealer: {
            name: data.dealerId?.name,
            phone: data.dealerId?.phone,
            address: data.dealerId?.address,
            gstin: data.dealerId?.gstin,
          },

          warehouse: {
            name: data.warehouseId?.name,
          },

          items,
          totalGross,
          totalDiscountAmount,
          totalDiscountPercent,
          totalBeforeTax,
          totalTax,
          grandTotal,
        });
      } catch (err) {
        console.error(err);
        setError("Failed to load purchase bill");
      }
    };

    loadPurchase();
  }, [id]);

  if (error) {
    return <div style={{ padding: 24, color: "red" }}>{error}</div>;
  }

  if (!bill) {
    return <div style={{ padding: 24 }}>Loading purchase bill…</div>;
  }

  return (
    <div style={{ background: "white" }}>
      <PurchaseBillPreview bill={bill} onClose={() => router.back()} />
    </div>
  );
}

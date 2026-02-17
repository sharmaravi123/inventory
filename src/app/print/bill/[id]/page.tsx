"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import BillPreview from "@/app/admin/components/billing/BillPreview";
import { Bill } from "@/store/billingApi";

export default function PrintBillPage() {
  const { id } = useParams<{ id: string }>();
  const [bill, setBill] = useState<Bill | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const loadBill = async () => {
      try {
        const res = await fetch(`/api/billing/${id}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const txt = await res.text();
          console.error("API ERROR:", txt);
          setError("Bill not found");
          return;
        }

        const data = await res.json();
        setBill(data.bill);
      } catch (e) {
        console.error("FETCH FAILED:", e);
        setError("Failed to load bill");
      }
    };

    loadBill();
  }, [id]);

  if (error) {
    return (
      <div style={{ padding: 24, color: "red" }}>
        {error}
      </div>
    );
  }

  if (!bill) {
    return <div style={{ padding: 24 }}>Loading bill…</div>;
  }
  return (
    <div style={{ background: "white" }}>
      {/* onClose empty because print page */}
      <BillPreview bill={bill} onClose={() => {}} />
    </div>
  );
}

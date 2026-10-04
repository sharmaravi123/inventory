"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BillPreview from "@/app/admin/components/billing/BillPreview";
import { Bill } from "@/store/billingApi";

function PrintBillsPreview() {
  const params = useSearchParams();
  const router = useRouter();
  const idsParam = params.get("ids") || "";
  const [bills, setBills] = useState<Bill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      setError("No bills to preview");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const loaded = await Promise.all(
          ids.map(async (id) => {
            const res = await fetch(`/api/billing/${encodeURIComponent(id)}`, {
              cache: "no-store",
            });
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data?.error || "Bill not found");
            }
            return (data.bill ?? data) as Bill;
          })
        );
        if (!cancelled) setBills(loaded);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load bills");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [idsParam]);

  if (loading) {
    return <div style={{ padding: 24 }}>Loading bills…</div>;
  }

  if (error || bills.length === 0) {
    return (
      <div style={{ padding: 24, color: "red" }}>
        {error || "No bills to preview"}
      </div>
    );
  }

  return (
    <div style={{ background: "white" }}>
      <BillPreview bills={bills} onClose={() => router.back()} />
    </div>
  );
}

export default function PrintBillsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading bills…</div>}>
      <PrintBillsPreview />
    </Suspense>
  );
}

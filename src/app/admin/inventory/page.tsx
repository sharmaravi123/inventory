"use client";

import dynamic from "next/dynamic";

const AdminInventoryManager = dynamic(
  () => import("../components/Inventory/InventoryManager"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-50 p-6 text-sm text-slate-600">
        Loading inventory...
      </div>
    ),
  }
);

export default function InventoryPage() {
  return <AdminInventoryManager />;
}

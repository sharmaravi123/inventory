// src/app/admin/billing/page.tsx
"use client";

import dynamic from "next/dynamic";

const BillingAdminPage = dynamic(
  () => import("@/app/admin/components/billing/BillingAdminPage"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-50 p-6 text-sm text-slate-600">
        Loading billing...
      </div>
    ),
  }
);

export default function Page() {
  return <BillingAdminPage />;
}

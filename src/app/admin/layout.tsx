// src/app/admin/layout.tsx
export const dynamic = "force-dynamic";

import "../globals.css";
import Topbar from "./components/Topbar";
import Sidebar from "./components/Sidebar";
import React from "react";
import AdminGuard from "./components/AdminGuard";

export const metadata = {
  title: "Admin Dashboard | BlackOSInventory",
  description: "Admin dashboard",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-neutral)]">
      <Topbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 lg:ml-64 overflow-y-auto bg-[var(--color-neutral)]">
          <AdminGuard>{children}</AdminGuard>
        </main>
      </div>
    </div>
  );
}

// src/app/admin/layout.tsx
export const dynamic = "force-dynamic";

import "../globals.css";
import Topbar from "./components/Topbar";
import Sidebar from "./components/Sidebar";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";
import { AuthTokenPayload, verifyToken } from "@/lib/jwt";

export const metadata = {
  title: "Admin Dashboard | BlackOSInventory",
  description: "Admin dashboard",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value ?? null;

  if (!token) {
    redirect("/");
  }

  let payload: AuthTokenPayload;
  try {
    payload = verifyToken(token);
  } catch {
    redirect("/");
  }

  if (payload.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-neutral)]">
      <Topbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 lg:ml-64 overflow-y-auto bg-[var(--color-neutral)]">
          {children}
        </main>
      </div>
    </div>
  );
}

// src/app/admin/layout.tsx
import "../globals.css";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import { verifyAppToken } from "@/lib/jwt";

export const metadata = {
  title: "Admin Panel | BlackOSInventory",
  description: "Admin dashboard",
};

const COOKIE_NAME = "token";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;

  if (!token) {
    redirect("/");
  }

  try {
    const payload = verifyAppToken(token);

    if (payload.role !== "ADMIN") {
      redirect("/");
    }
  } catch {
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

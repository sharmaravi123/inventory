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

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 👇 yahan await lagao
  const cookieStore = await cookies();

  const token =
    cookieStore.get("adminToken")?.value ??
    cookieStore.get("token")?.value ??
    null;

  if (!token) {
    redirect("/");
  }

  let payload: ReturnType<typeof verifyAppToken>;
  try {
    payload = verifyAppToken(token);
  } catch {
    redirect("/");
  }

  const role = typeof payload.role === "string" ? payload.role : "";
  if (role.toLowerCase() !== "admin") {
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

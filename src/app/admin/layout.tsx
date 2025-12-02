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

// yahan wahi naam rakho jo tum admin login API + middleware me use kar rahe ho
// example: "adminToken"
const COOKIE_NAME = "token";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;

  // 1) token hi nahi mila → admin login page par bhejo
  if (!token) {
    redirect("/");
  }

  let payload: ReturnType<typeof verifyAppToken>;
  try {
    payload = verifyAppToken(token);
  } catch {
    // 2) token invalid / expire → login page
    redirect("/");
  }

  // 3) role check
  if (payload.role !== "ADMIN") {
    // agar admin nahi hai, normal home pe bhej do
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

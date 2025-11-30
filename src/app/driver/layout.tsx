// src/app/driver/layout.tsx
import "../globals.css";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";
import DriverSidebar from "./components/sidebar";
import Topbar from "./components/topbar";
import { verifyAppToken } from "@/lib/jwt";

export const metadata = {
  title: "Driver Panel | BlackOSInventory",
  description: "Driver dashboard",
};

const COOKIE_NAME = "token";

export default async function DriverLayout({
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
    if (payload.role !== "DRIVER") {
      redirect("/");
    }
  } catch {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-neutral)]">
      <Topbar />
      <div className="flex flex-1">
        <DriverSidebar />
        <main className="flex-1 p-6 lg:ml-64 overflow-y-auto bg-[var(--color-neutral)]">
          {children}
        </main>
      </div>
    </div>
  );
}

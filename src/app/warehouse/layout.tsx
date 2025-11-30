// src/app/warehouse/layout.tsx
export const dynamic = "force-dynamic";

import React from "react";
import "../globals.css";
import Topbar from "./components/Topbar";
import Sidebar from "./components/Sidebar";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import "@/models/Warehouse";
import { AppJwtPayload, verifyAppToken } from "@/lib/jwt";

export const metadata = {
  title: "Warehouse Dashboard | BlackOSInventory",
  description: "Warehouse dashboard",
};

interface PopulatedWarehouse {
  _id: { toString(): string };
  name?: string;
}

interface UserLean {
  _id: { toString(): string };
  name?: string;
  warehouses?: PopulatedWarehouse[];
  access?: { permissions?: string[] } | null;
}

export default async function WarehouseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value ?? null;

  if (!token) {
    redirect("/");
  }

  let payload: AppJwtPayload;
  try {
    payload = verifyAppToken(token);
  } catch {
    redirect("/");
  }

  // 🔵 Warehouse area ke liye JWT me role "warehouse" expect kar rahe
  // agar admin ko bhi allow karna hai to is condition ko change karke:
  // if (payload.role !== "warehouse" && payload.role !== "admin") { ... }
  if (payload.role !== "WAREHOUSE") {
    redirect("/");
  }

  const userId = payload.sub;

  await dbConnect();

  const user = (await User.findById(userId)
    .select("-password")
    .populate("warehouses", "name")
    .lean()) as UserLean | null;

  if (!user) {
    redirect("/");
  }

  const warehouses: Array<{ _id: string; name?: string }> = Array.isArray(
    user.warehouses
  )
    ? user.warehouses.map((w) => ({
        _id: w._id.toString(),
        name: w.name,
      }))
    : [];

  const allowedPerms = user.access?.permissions ?? [];

  if (!warehouses.length) {
    redirect("/");
  }

  const permToPathMap: Record<string, string> = {
    inventory: "/warehouse/inventory",
    orders: "/warehouse/orders",
    reports: "/warehouse/reports",
    billing: "/warehouse/billing",
  };

  const allowedPaths = allowedPerms
    .map((p) => permToPathMap[p])
    .filter((p): p is string => Boolean(p));

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-neutral)]">
      <Topbar />
      <div className="flex flex-1">
        <Sidebar allowedPerms={allowedPerms} allowedPaths={allowedPaths} />
        <main className="flex-1 p-6 lg:ml-64 overflow-y-auto bg-[var(--color-neutral)]">
          {children}
        </main>
      </div>
    </div>
  );
}

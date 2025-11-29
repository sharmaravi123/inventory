// src/app/warehouse/reports/page.tsx
export const dynamic = "force-dynamic";
import React from "react";
import { cookies } from "next/headers";
import { ensureHasAccess, getUserFromTokenOrDb } from "@/lib/access";
import WarehouseReportsPage from "../components/reports/WarehouseReportsPage";

export default async function WarehouseReportsPageWrapper() {
  try {
    const cookieStore = await cookies();
        const token = cookieStore.get("token")?.value ?? null;
    
        // Ab yeh redirect nahi karega, sirf { user, authorized } dega
        const { user, authorized } = await ensureHasAccess(token, {
          path: "/warehouse/reports",
        });
    
        // 1) Not logged in
        if (!user) {
          return (
            <div className="p-6">
              <h1 className="text-xl font-semibold">Billing</h1>
              <p className="text-sm text-gray-600">Not authenticated.</p>
            </div>
          );
        }
    
        // 2) Logged in but no permission
        if (!authorized) {
          return (
            <div className="p-6">
              <h1 className="text-xl font-semibold">Access denied / Error</h1>
              <p className="text-sm text-gray-600">
                You do not have permission to access Billing for warehouses, or there was a server error.
              </p>
            </div>
          );
        }
    
        // 3) Authorized: same logic as pehle
        const isAdmin = user.role === "admin";

    // admin => undefined (no restriction), warehouse user => list of ids
    const allowedWarehouseIds: string[] | undefined = isAdmin
      ? undefined
      : Array.isArray(user.warehouses)
      ? user.warehouses
          .map((w: unknown) =>
            typeof w === "string" ? w : String(((w as { _id?: unknown })._id) ?? "")
          )
          .filter((id) => id !== "")
      : [];

    // warehouse user but no warehouses assigned
    if (!isAdmin && Array.isArray(allowedWarehouseIds) && allowedWarehouseIds.length === 0) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-semibold">Warehouse Reports</h1>
          <p className="mt-2 text-sm text-gray-600">
            No warehouse is assigned to your account. Please contact the administrator.
          </p>
        </div>
      );
    }

    return (
      <div className="p-4 sm:p-6">
        <WarehouseReportsPage allowedWarehouseIds={allowedWarehouseIds} />
      </div>
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Warehouse reports page error:", error);
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Warehouse Reports</h1>
        <p className="mt-2 text-sm text-gray-600">
          Failed to load reports. Try again later.
        </p>
      </div>
    );
  }
}

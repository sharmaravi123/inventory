// src/app/warehouse/orders/page.tsx
export const dynamic = "force-dynamic";
import React from "react";
import { cookies } from "next/headers";
import { ensureHasAccess } from "@/lib/access";
import WarehouseOrdersPage from "../components/orders/WarehouseOrdersPage";

export default async function WarehouseOrdersPageWrapper() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value ?? null;

    const { user, authorized } = await ensureHasAccess(token, {
      path: "/warehouse/orders",
    });

    if (!user) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-semibold">Billing</h1>
          <p className="text-sm text-gray-600">Not authenticated.</p>
        </div>
      );
    }

    if (!authorized) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-semibold">Access denied / Error</h1>
          <p className="text-sm text-gray-600">
            You do not have permission to access Billing for warehouses, or
            there was a server error.
          </p>
        </div>
      );
    }

    const isAdmin = user.role === "admin";

    const allowedWarehouseIds: string[] | undefined = isAdmin
      ? undefined
      : Array.isArray(user.warehouses)
      ? user.warehouses
          .map((w: unknown) =>
            typeof w === "string"
              ? w
              : String(((w as { _id?: unknown })._id) ?? "")
          )
          .filter((id) => id !== "")
      : [];

    if (
      !isAdmin &&
      Array.isArray(allowedWarehouseIds) &&
      allowedWarehouseIds.length === 0
    ) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-semibold">Warehouse Orders</h1>
          <p className="mt-2 text-sm text-gray-600">
            No warehouse is assigned to your account. Please contact the
            administrator.
          </p>
        </div>
      );
    }

    return (
      <div className="p-4 sm:p-6">
        <WarehouseOrdersPage allowedWarehouseIds={allowedWarehouseIds} />
      </div>
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Warehouse orders page error:", error);
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Warehouse Orders</h1>
        <p className="mt-2 text-sm text-gray-600">
          Failed to load orders. Try again later.
        </p>
      </div>
    );
  }
}

// src/app/warehouse/billing/page.tsx
import React from "react";
import { cookies } from "next/headers";
import { ensureHasAccess } from "@/lib/access";
import BillingWarehousePage from "@/app/warehouse/components/billing/BillingWarehousePage";

type WarehouseRef = { _id?: unknown };

export default async function WarehouseBillingPage() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value ?? null;

    // Ab yeh redirect nahi karega, sirf { user, authorized } dega
    const { user, authorized } = await ensureHasAccess(token, {
      path: "/warehouse/billing",
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

    const allowedWarehouseIds: string[] | undefined = isAdmin
      ? undefined
      : Array.isArray(user.warehouses)
      ? (user.warehouses as WarehouseRef[])
          .map((w) =>
            w._id === undefined || w._id === null ? undefined : String(w._id)
          )
          .filter((id): id is string => Boolean(id))
      : [];

    if (Array.isArray(allowedWarehouseIds) && allowedWarehouseIds.length === 0) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-semibold">Billing</h1>
          <p className="text-sm text-gray-600">
            No warehouse is assigned to your account. Please contact the administrator.
          </p>
        </div>
      );
    }

    return (
      <div className="p-6">
        <BillingWarehousePage
          allowedWarehouseIdsProp={allowedWarehouseIds}
          assignedWarehouseForUser={
            Array.isArray(allowedWarehouseIds) ? allowedWarehouseIds : undefined
          }
        />
      </div>
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Warehouse billing page error:", err);
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Billing</h1>
        <p className="text-sm text-gray-600">
          Failed to load billing page. Try again later.
        </p>
      </div>
    );
  }
}

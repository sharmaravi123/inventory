// src/app/admin/products/page.tsx
import React from "react";
import { cookies } from "next/headers";
import { ensureHasAccess, getUserFromTokenOrDb } from "@/lib/access";
import ProductTable from "@/app/admin/components/product/ProductTable";

export default async function ProductsPage() {
  try {
    const cookieStore = await cookies();
        const token = cookieStore.get("token")?.value ?? null;
    
        // Ab yeh redirect nahi karega, sirf { user, authorized } dega
        const { user, authorized } = await ensureHasAccess(token, {
          path: "/warehouse/product",
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

    // access ok -> render client UI (client will fetch data)
    return <ProductTable   />;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Products page server error:", err);
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Access denied / Error</h1>
        <p className="text-sm text-gray-600">You do not have permission or there was a server error.</p>
      </div>
    );
  }
}

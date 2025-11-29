// src/app/warehouse/inventory/page.tsx
export const dynamic = "force-dynamic";
import React from "react";
import { cookies } from "next/headers";
import { ensureHasAccess, getUserFromTokenOrDb } from "@/lib/access";
import dbConnect from "@/lib/mongodb";
import Stock from "@/models/Stock";
import Product from "@/models/Product";
import Warehouse from "@/models/Warehouse";
import UserInventoryManager from "@/app/warehouse/components/inventory/UserInventoryManager";

type StockLean = {
  _id: string;
  productId?: string;
  warehouseId?: string;
  boxes: number;
  itemsPerBox: number;
  looseItems: number;
  totalItems: number;
  lowStockBoxes?: number | null;
  lowStockItems?: number | null;
  tax: number;
  createdAt?: string;
  updatedAt?: string;
  product?: { _id?: string; name?: string };
  warehouse?: { _id?: string; name?: string };
};

export default async function WarehouseInventoryPage() {
  try {
    const cookieStore = await cookies();
        const token = cookieStore.get("token")?.value ?? null;
    
        // Ab yeh redirect nahi karega, sirf { user, authorized } dega
        const { user, authorized } = await ensureHasAccess(token, {
          path: "/warehouse/inventory",
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
      : (Array.isArray(user.warehouses) ? user.warehouses.map((w) => String((w as { _id?: unknown })._id)) : []);

    await dbConnect();

    // if user limited and has zero -> render empty manager and disallow add
    if (Array.isArray(allowedWarehouseIds) && allowedWarehouseIds.length === 0) {
      return (
        <div className="p-6">
          <UserInventoryManager initialItems={[]} allowedWarehouseIdsProp={[]} assignedWarehouseForUser={[]} />
        </div>
      );
    }

    // build query (if array => restrict; if undefined => admin => all)
    const query: Record<string, unknown> = {};
    if (Array.isArray(allowedWarehouseIds)) query.warehouseId = { $in: allowedWarehouseIds };

    // fetch stocks WITHOUT populate to avoid StrictPopulateError
    const rawStocks = await Stock.find(query).sort({ createdAt: -1 }).lean();
    const stocks = rawStocks as unknown as Record<string, unknown>[];

    // gather product and warehouse ids
    const productIdSet = new Set<string>();
    const warehouseIdSet = new Set<string>();
    stocks.forEach((s) => {
      const pid = s.productId === undefined ? undefined : String(s.productId);
      const wid = s.warehouseId === undefined ? undefined : String(s.warehouseId);
      if (pid) productIdSet.add(pid);
      if (wid) warehouseIdSet.add(wid);
    });

    const productIds = Array.from(productIdSet);
    const warehouseIds = Array.from(warehouseIdSet);

    const [productsList, warehousesList] = await Promise.all([
      productIds.length ? Product.find({ _id: { $in: productIds } }).select("name").lean() : Promise.resolve([]),
      warehouseIds.length ? Warehouse.find({ _id: { $in: warehouseIds } }).select("name").lean() : Promise.resolve([]),
    ]);

    const productNameMap: Record<string, string> = {};
    (productsList as Array<{ _id?: unknown; name?: unknown }>).forEach((p) => {
      if (p._id !== undefined) productNameMap[String(p._id)] = typeof p.name === "string" ? p.name : "";
    });

    const warehouseNameMap: Record<string, string> = {};
    (warehousesList as Array<{ _id?: unknown; name?: unknown }>).forEach((w) => {
      if (w._id !== undefined) warehouseNameMap[String(w._id)] = typeof w.name === "string" ? w.name : "";
    });

    const initialItems: StockLean[] = stocks.map((r) => {
      const boxes = typeof r.boxes === "number" ? r.boxes : Number(r.boxes ?? 0);
      const itemsPerBox = typeof r.itemsPerBox === "number" ? r.itemsPerBox : Math.max(1, Number(r.itemsPerBox ?? 1));
      const looseItems = typeof r.looseItems === "number" ? r.looseItems : Number(r.looseItems ?? 0);
      const totalItems = typeof r.totalItems === "number" ? r.totalItems : boxes * itemsPerBox + looseItems;
      const lowStockBoxes = typeof r.lowStockBoxes === "number" ? r.lowStockBoxes : null;
      const lowStockItems = typeof r.lowStockItems === "number" ? r.lowStockItems : null;
      const tax = typeof r.tax === "number" ? r.tax : Number(r.tax ?? 0);

      const pid = r.productId === undefined ? undefined : String(r.productId);
      const wid = r.warehouseId === undefined ? undefined : String(r.warehouseId);

      return {
        _id: r._id ? String(r._id) : "",
        productId: pid,
        warehouseId: wid,
        boxes,
        itemsPerBox,
        looseItems,
        totalItems,
        lowStockBoxes,
        lowStockItems,
        tax,
        createdAt: r.createdAt ? String(r.createdAt) : undefined,
        updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
        product: pid ? { _id: pid, name: productNameMap[pid] ?? undefined } : undefined,
        warehouse: wid ? { _id: wid, name: warehouseNameMap[wid] ?? undefined } : undefined,
      };
    });

    return (
      <div className="p-6">
        <UserInventoryManager
          initialItems={initialItems}
          allowedWarehouseIdsProp={allowedWarehouseIds}
          assignedWarehouseForUser={allowedWarehouseIds}
        />
      </div>
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Warehouse inventory page error:", err);
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Inventory</h1>
        <p className="text-sm text-gray-600">Failed to load inventory. Try again later.</p>
      </div>
    );
  }
}

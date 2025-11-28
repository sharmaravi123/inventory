"use client";

import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/store/store";
import {
  fetchInventory,
  type InventoryItem,
} from "@/store/inventorySlice";

type InventorySliceState = {
  items: InventoryItem[];
  loading: boolean;
  error?: string | null;
};

type AlertRow = {
  id: string;
  name: string;
  category: string;
  stock: number;
  out: boolean;
  updated: string;
};

function getTotalItems(item: InventoryItem): number {
  if (typeof item.totalItems === "number") return item.totalItems;
  return item.boxes * item.itemsPerBox + item.looseItems;
}

function getLowThresholdPieces(item: InventoryItem): number | null {
  // priority: lowStockItems > lowStockBoxes
  if (typeof item.lowStockItems === "number" && item.lowStockItems >= 0) {
    return item.lowStockItems;
  }

  if (
    typeof item.lowStockBoxes === "number" &&
    item.lowStockBoxes >= 0 &&
    item.itemsPerBox > 0
  ) {
    return item.lowStockBoxes * item.itemsPerBox;
  }

  return null;
}

export default function LowStockAlerts() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    void dispatch(fetchInventory());
  }, [dispatch]);

  const { items, loading } = useSelector((state: RootState) => {
    const inv = state.inventory as InventorySliceState;
    return {
      items: inv.items,
      loading: inv.loading,
    };
  });

  const alerts: AlertRow[] = useMemo(() => {
    const rows: AlertRow[] = [];

    items.forEach((item) => {
      const total = getTotalItems(item);
      const threshold = getLowThresholdPieces(item);

      const isOut = total === 0;
      const isLow = threshold !== null && total > 0 && total <= threshold;

      // sirf wahi products jinka low config hai ya out-of-stock hain
      if (!isOut && !isLow) return;

      const name =
        item.product?.name ??
        (typeof item.productId === "string" ? item.productId : "Unknown");

      const category =
        item.warehouse?.name ??
        (typeof item.warehouseId === "string" ? item.warehouseId : "N/A");

      const updated = item.updatedAt
        ? new Date(item.updatedAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "-";

      rows.push({
        id: item._id,
        name,
        category,
        stock: total,
        out: isOut,
        updated,
      });
    });

    // sort: out-of-stock first, then lowest stock
    rows.sort((a, b) => {
      if (a.out && !b.out) return -1;
      if (!a.out && b.out) return 1;
      return a.stock - b.stock;
    });

    // optionally limit to top N alerts
    // return rows.slice(0, 10);
    return rows;
  }, [items]);

  return (
    <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-6 w-full max-w-md">
      <h2 className="text-xl font-semibold text-gray-900">Low Stock Alerts</h2>
      <p className="text-sm text-gray-500 mb-4">
        Products requiring immediate restocking.
      </p>

      {loading ? (
        <p className="text-sm text-gray-600">Loading...</p>
      ) : alerts.length === 0 ? (
        <p className="text-sm text-gray-600">All items are in good stock</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-gray-700">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-2 text-left">Product</th>
                <th className="py-2 text-left">Location</th>
                <th className="py-2 text-left">Stock</th>
                <th className="py-2 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2">{p.name}</td>
                  <td className="py-2">{p.category}</td>
                  <td className="py-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        p.out
                          ? "bg-[var(--color-error)] text-white"
                          : "bg-[var(--color-warning)] text-black"
                      }`}
                    >
                      {p.out ? "Out" : p.stock}
                    </span>
                  </td>
                  <td className="py-2 text-gray-500">{p.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-gray-400 mt-4 text-center">
        Made with 💙 Akash Namkeen
      </div>
    </div>
  );
}

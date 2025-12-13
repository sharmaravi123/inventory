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

export default function LowStockAlerts() {
  const dispatch = useDispatch<AppDispatch>();

  const { items, loading, products } = useSelector((state: RootState) => ({
    items: state.inventory.items,
    loading: state.inventory.loading,
    products: state.product.products,
  }));

  useEffect(() => {
    void dispatch(fetchInventory());
  }, [dispatch]);

  // helper: get itemsPerBox from product model
  const getItemsPerBox = (productId: string) => {
    const p = products?.find(
      (prod) => String(prod._id ?? prod.id) === productId
    );
    return p?.perBoxItem ?? p?.perBoxItem ?? 1;
  };

  const alerts: AlertRow[] = useMemo(() => {
    const rows: AlertRow[] = [];

    items.forEach((item) => {
      const qtyPerBox = getItemsPerBox(item.productId ?? "");

      // total items calculation
      const total =
        item.boxes * qtyPerBox + item.looseItems;

      // threshold calculation
      const threshold =
        (item.lowStockItems ?? null) !== null
          ? item.lowStockItems
          : (item.lowStockBoxes ?? null) !== null
            ? (item.lowStockBoxes ?? 0) * qtyPerBox
            : null;

      const isOut = total === 0;
      const isLow =
        threshold !== null &&
        typeof threshold === "number" &&
        total > 0 &&
        total <= threshold;


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

    rows.sort((a, b) => {
      if (a.out && !b.out) return -1;
      if (!a.out && b.out) return 1;
      return a.stock - b.stock;
    });

    return rows;
  }, [items, products]);

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
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${p.out
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

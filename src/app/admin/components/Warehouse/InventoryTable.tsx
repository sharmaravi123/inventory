"use client";

import React, { useState } from "react";
import { InventoryItem } from "@/store/inventorySlice";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

function StatusPill({ qty }: { qty: number }) {
  const status =
    qty === 0
      ? "bg-red-500 text-white"
      : qty <= 5
      ? "bg-yellow-400 text-black"
      : "bg-green-500 text-white";
  const label =
    qty === 0 ? "Out of Stock" : qty <= 5 ? "Low Stock" : "In Stock";
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${status}`}>{label}</span>
  );
}

export default function InventoryTable({
  rows,
  warehouse,
}: {
  rows: InventoryItem[];
  warehouse: string;
}) {
  const { categories } = useSelector((state: RootState) => state.category);

  return (
    <div className="mt-6 border rounded-lg overflow-x-auto">
      <table className="min-w-[900px] w-full text-sm border-collapse">
        <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
          <tr>
            <th className="p-3 text-left">Product</th>
            {/* <th className="p-3 text-left">Category</th> */}
            <th className="p-3 text-center">Boxes</th>
            <th className="p-3 text-center">Items/Box</th>
            <th className="p-3 text-center">Loose</th>
            <th className="p-3 text-center">Total Items</th>
            <th className="p-3 text-center">Status</th>
            <th className="p-3 text-center">Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="text-center py-8 text-gray-500">
                No products found for {warehouse}.
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const total = r.boxes * r.itemsPerBox + r.looseItems;

              // Get category name from categoryId
              const category = categories.find(
                (c) => c.id === r.product?.categoryId

              );
              console.log(category)

              return (
                <tr
                  key={r.id}
                  className="border-b hover:bg-gray-50 transition-colors"
                >
                  <td className="p-3 font-medium">{r.product?.name}</td>
                  <td className="p-3 text-center">{r.boxes}</td>
                  <td className="p-3 text-center">{r.itemsPerBox}</td>
                  <td className="p-3 text-center">{r.looseItems}</td>
                  <td className="p-3 text-center font-semibold">{total}</td>
                  <td className="p-3 text-center">
                    <StatusPill qty={total} />
                  </td>
                  <td className="p-3 text-center text-gray-500">
                    {new Date(r.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

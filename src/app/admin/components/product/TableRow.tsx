"use client";

import React from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/store/store";
import { deleteProduct } from "@/store/productSlice";

interface Category {
  id?: string | number;
  _id?: string;
  name?: string;
}

interface Product {
  id: string | number;
  sku?: string;
  name?: string;
  category?: Category | string | number | null;
  categoryId?: string | number | null;
  purchasePrice?: number;
  sellingPrice?: number;
  description?: string;
  taxRate?: number;
  [key: string]: unknown;
}

interface TableRowProps {
  product: Product;
  onEdit: (p: Product) => void;
}

export default function TableRow({ product, onEdit }: TableRowProps): React.ReactElement {
  const dispatch = useDispatch<AppDispatch>();

  const categoryName = (() => {
    const c = product.category ?? (product.categoryId ? { id: product.categoryId } : null);
    if (!c) return "—";
    if (typeof c === "string" || typeof c === "number") return String(c);
    return (c as Category).name ?? String((c as Category)._id ?? (c as Category).id ?? "—");
  })();

  const purchaseDisplay = typeof product.purchasePrice === "number" ? product.purchasePrice.toFixed(2) : "—";
  const sellingDisplay = typeof product.sellingPrice === "number" ? product.sellingPrice.toFixed(2) : "—";

  return (
    <tr className="border-t hover:bg-gray-50 transition-all duration-200">
      <td className="p-4">{product.sku}</td>
      <td className="p-4">{product.name}</td>
      <td className="p-4">{categoryName}</td>
      <td className="p-4">{purchaseDisplay}</td>
      <td className="p-4">{sellingDisplay}</td>
      <td className="p-4">{typeof product.taxRate === "number" ? product.taxRate.toFixed(2) : "—"}</td>
      
      <td className="p-4 text-right space-x-2">
        <button
          onClick={() => onEdit(product)}
          className="px-3 py-1 border border-primary text-[var(--color-primary)] rounded hover:bg-[var(--color-primary)] hover:text-white transition-all"
        >
          Edit
        </button>
        <button
          onClick={() => dispatch(deleteProduct(String(product.id)))}
          className="px-3 py-1 border border-error text-[var(--color-error)] rounded hover:bg-[var(--color-error)] hover:text-white transition-all"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

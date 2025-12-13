"use client";

import React from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/store/store";
import { deleteProduct } from "@/store/productSlice";
import type { ProductType } from "@/store/productSlice";

interface Category {
  id?: string | number;
  _id?: string;
  name?: string;
}

interface TableRowProps {
  product: ProductType & {
    taxPercent?: number | null;
    perBoxItem?: number | null;
    hsnCode?: string | null; 
  };
  onEdit: (p: ProductType & { taxPercent?: number | null; perBoxItem?: number | null }) => void;
}

export default function TableRow({
  product,
  onEdit,
}: TableRowProps): React.ReactElement {
  const dispatch = useDispatch<AppDispatch>();

  const categoryName = (() => {
    const c =
      product.category ??
      (product.categoryId ? { id: product.categoryId } : null);
    if (!c) return "—";
    if (typeof c === "string" || typeof c === "number") return String(c);
    const catObj = c as Category;
    return catObj.name ?? String(catObj._id ?? catObj.id ?? "—");
  })();

  const purchaseDisplay =
    typeof product.purchasePrice === "number"
      ? product.purchasePrice.toFixed(2)
      : "—";

  const sellingDisplay =
    typeof product.sellingPrice === "number"
      ? product.sellingPrice.toFixed(2)
      : "—";

  const taxPercent =
    typeof product.taxPercent === "number" ? product.taxPercent : undefined;
  const perBoxItem =
    typeof product.perBoxItem === "number" ? product.perBoxItem : undefined;

  const taxDisplay =
    taxPercent !== undefined ? `${taxPercent.toFixed(2)}%` : "—";
  const perBoxDisplay =
    perBoxItem !== undefined ? String(perBoxItem) : "—";

  return (
    <tr className="border-t border-[var(--color-neutral)] hover:bg-[var(--color-neutral)] transition-colors">
      <td className="p-3 align-middle text-[var(--color-sidebar)]">
        {product.sku}
      </td>
      <td className="p-3 align-middle text-[var(--color-sidebar)]">
        {product.name}
      </td>
        <td className="p-3 align-middle text-[var(--color-sidebar)]">
    {product.hsnCode ?? "—"} 
  </td>
      <td className="p-3 align-middle text-[var(--color-sidebar)]">
        {categoryName}
      </td>
      <td className="p-3 align-middle text-right text-[var(--color-sidebar)]">
        {purchaseDisplay}
      </td>
      <td className="p-3 align-middle text-right text-[var(--color-sidebar)]">
        {sellingDisplay}
      </td>
      <td className="p-3 align-middle text-right text-[var(--color-sidebar)]">
        {taxDisplay}
      </td>
      <td className="p-3 align-middle text-right text-[var(--color-sidebar)]">
        {perBoxDisplay}
      </td>
      <td className="p-3 align-middle text-right">
        <div className="inline-flex gap-2">
          <button
            onClick={() => onEdit(product)}
            className="rounded-full border border-[var(--color-primary)] px-3 py-1 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-white)] transition"
          >
            Edit
          </button>
          <button
            onClick={() => dispatch(deleteProduct(String(product.id)))}
            className="rounded-full border border-[var(--color-error)] px-3 py-1 text-xs font-medium text-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-[var(--color-white)] transition"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

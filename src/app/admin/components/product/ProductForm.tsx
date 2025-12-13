"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { addProduct, updateProduct } from "@/store/productSlice";

export interface Category {
  _id?: string;
  id?: string | number;
  name?: string;
}

export interface ProductEditData {
  id?: string | number;
  name?: string;
  category?:
  | { id?: string | number; _id?: string; name?: string }
  | string
  | number
  | null;
  categoryId?: string | number;
  purchasePrice?: number;
  sellingPrice?: number;
  description?: string;
  taxPercent?: number;
  perBoxItem?: number;
  hsnCode?: string;
}

interface ProductFormProps {
  onClose: () => void;
  editData?: ProductEditData;
}

export default function ProductForm({ onClose, editData }: ProductFormProps) {
  const dispatch = useDispatch<AppDispatch>();
  const categories = useSelector(
    (state: RootState) => state.category.categories ?? []
  ) as Category[];

  const [form, setForm] = useState({
    name: editData?.name ?? "",
    categoryId: String(
      editData?.categoryId ??
      (typeof editData?.category === "object"
        ? (editData.category as Category)?._id ??
        (editData.category as Category)?.id ??
        ""
        : editData?.category ?? "")
    ),
    purchasePrice:
      editData?.purchasePrice != null ? String(editData.purchasePrice) : "",
    sellingPrice:
      editData?.sellingPrice != null ? String(editData.sellingPrice) : "",
    taxPercent:
      editData?.taxPercent != null ? String(editData.taxPercent) : "",
    perBoxItem:
      editData?.perBoxItem != null ? String(editData.perBoxItem) : "",
    hsnCode: editData?.hsnCode ?? "",
    description: editData?.description ?? "",
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();

  const payload = {
    name: form.name.trim(),
    categoryId: String(form.categoryId),
    purchasePrice: form.purchasePrice === "" ? 0 : Number(form.purchasePrice),
    sellingPrice: form.sellingPrice === "" ? 0 : Number(form.sellingPrice),
    description: form.description,
    taxPercent: form.taxPercent === "" ? 0 : Number(form.taxPercent),
    perBoxItem: form.perBoxItem === "" ? 1 : Number(form.perBoxItem),
    hsnCode: form.hsnCode.trim() === "" ? null : form.hsnCode.trim(), // 👈 IMPORTANT
  };

  if (!payload.name || !payload.categoryId) {
    await Swal.fire("Validation", "Name and category are required.", "warning");
    return;
  }

  if (Number.isNaN(payload.taxPercent) || payload.taxPercent < 0 || payload.taxPercent > 100) {
    await Swal.fire(
      "Validation",
      "Tax percent must be between 0 and 100.",
      "warning"
    );
    return;
  }

  if (Number.isNaN(payload.perBoxItem) || payload.perBoxItem <= 0) {
    await Swal.fire(
      "Validation",
      "Per box item must be a positive number.",
      "warning"
    );
    return;
  }

  try {
    if (editData && editData.id !== undefined) {
      await dispatch(
        updateProduct({ id: String(editData.id), ...payload })
      ).unwrap();
      await Swal.fire("Updated!", "Product updated successfully.", "success");
    } else {
      await dispatch(addProduct(payload)).unwrap();
      await Swal.fire("Added!", "Product added successfully.", "success");
    }
    onClose();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await Swal.fire(
      "Error",
      error.message || "Something went wrong.",
      "error"
    );
  }
};


  return (
    <AnimatePresence>
      <motion.div
        key="modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <motion.form
          onSubmit={handleSubmit}
          initial={{ scale: 0.9, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 10 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-lg rounded-2xl border border-[var(--color-neutral)] bg-[var(--color-white)] p-6 shadow-2xl"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-sidebar)]">
                {editData ? "Edit Product" : "Add Product"}
              </h3>
              <p
                className="mt-1 text-xs"
                style={{ color: "var(--color-sidebar)", opacity: 0.7 }}
              >
                Define pricing, tax and per box quantity for this item.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 hover:bg-[var(--color-neutral)] transition"
              aria-label="Close"
            >
              <span
                className="block text-sm"
                style={{ color: "var(--color-sidebar)" }}
              >
                ✕
              </span>
            </button>
          </div>

          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--color-sidebar)]">
                Product Name
              </label>
              <input
                placeholder="Product Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-neutral)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--color-sidebar)]">
                Category
              </label>
              <select
                value={form.categoryId}
                onChange={(e) =>
                  setForm({ ...form, categoryId: e.target.value })
                }
                className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-neutral)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option
                    key={String(c.id ?? c._id)}
                    value={String(c.id ?? c._id)}
                  >
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-sidebar)]">
                HSN Number
              </label>
              <input
                placeholder="e.g. 30049011"
                value={form.hsnCode}
                onChange={(e) =>
                  setForm({ ...form, hsnCode: e.target.value })
                }
                className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-neutral)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
              />
              <p
                className="mt-1 text-[10px]"
                style={{ color: "var(--color-sidebar)", opacity: 0.7 }}
              >
                GST / HSN classification code for this product.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-sidebar)]">
                Purchase Price
              </label>
              <input
                type="number"
                placeholder="0"
                value={form.purchasePrice}
                onChange={(e) =>
                  setForm({ ...form, purchasePrice: e.target.value })
                }
                className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-neutral)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-sidebar)]">
                Selling Price
              </label>
              <input
                type="number"
                placeholder="0"
                value={form.sellingPrice}
                onChange={(e) =>
                  setForm({ ...form, sellingPrice: e.target.value })
                }
                className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-neutral)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-sidebar)]">
                Tax (%)
              </label>
              <input
                type="number"
                placeholder="0"
                value={form.taxPercent}
                onChange={(e) =>
                  setForm({ ...form, taxPercent: e.target.value })
                }
                className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-neutral)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
              />
              <p
                className="mt-1 text-[10px]"
                style={{ color: "var(--color-sidebar)", opacity: 0.7 }}
              >
                GST / VAT percentage for this product.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-sidebar)]">
                Per Box Item
              </label>
              <input
                type="number"
                placeholder="e.g. 12"
                value={form.perBoxItem}
                onChange={(e) =>
                  setForm({ ...form, perBoxItem: e.target.value })
                }
                className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-neutral)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
              />
              <p
                className="mt-1 text-[10px]"
                style={{ color: "var(--color-sidebar)", opacity: 0.7 }}
              >
                How many pieces are inside one box / carton.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[var(--color-sidebar)]">
                Description
              </label>
              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="h-24 w-full resize-none rounded-lg border border-[var(--color-neutral)] bg-[var(--color-neutral)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-white)] px-4 py-2 text-sm font-medium text-[var(--color-sidebar)] hover:bg-[var(--color-neutral)] transition sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full rounded-lg bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-[var(--color-white)] shadow-md hover:brightness-95 transition sm:w-auto"
            >
              {editData ? "Update Product" : "Add Product"}
            </button>
          </div>
        </motion.form>
      </motion.div>
    </AnimatePresence>
  );
}

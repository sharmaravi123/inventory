"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { addProduct, updateProduct } from "@/store/productSlice";

/** Local types */
export interface Category {
  _id?: string;
  id?: string | number;
  name?: string;
}

export interface ProductEditData {
  id?: string | number;
  name?: string;
  // Accept both category objects and simple categoryId; object may include name
  category?: { id?: string | number; _id?: string; name?: string } | string | number | null;
  categoryId?: string | number;
  purchasePrice?: number;
  sellingPrice?: number;
  description?: string;
  taxRate?: number;
}

interface ProductFormProps {
  onClose: () => void;
  editData?: ProductEditData;
}

export default function ProductForm({ onClose, editData }: ProductFormProps) {
  const dispatch = useDispatch<AppDispatch>();
  const categories = useSelector((state: RootState) => state.category.categories ?? []) as Category[];

  // controlled inputs stored as strings
  const [form, setForm] = useState({
    name: editData?.name ?? "",
    categoryId: String(editData?.categoryId ?? (typeof editData?.category === "object" ? (editData.category as Category)?._id ?? (editData.category as Category)?.id ?? "" : editData?.category ?? "")),
    purchasePrice: editData?.purchasePrice != null ? String(editData.purchasePrice) : "",
    sellingPrice: editData?.sellingPrice != null ? String(editData.sellingPrice) : "",
    description: editData?.description ?? "",
    taxRate: editData?.taxRate != null ? String(editData.taxRate) : "",
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const payload = {
      name: form.name,
      categoryId: String(form.categoryId),
      purchasePrice: form.purchasePrice === "" ? 0 : Number(form.purchasePrice),
      sellingPrice: form.sellingPrice === "" ? 0 : Number(form.sellingPrice),
      description: form.description,
      taxRate: form.taxRate === "" ? 0 : Number(form.taxRate),
    };

    try {
      if (editData && editData.id !== undefined) {
        await dispatch(updateProduct({ id: String(editData.id), ...payload })).unwrap();
        await Swal.fire("Updated!", "Product updated successfully.", "success");
      } else {
        await dispatch(addProduct(payload)).unwrap();
        await Swal.fire("Added!", "Product added successfully.", "success");
      }
      onClose();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      await Swal.fire("Error", error.message || "Something went wrong.", "error");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      >
        <motion.form
          onSubmit={handleSubmit}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl"
        >
          <h3 className="text-lg font-semibold mb-4 text-[var(--color-primary)]">
            {editData ? "Edit Product" : "Add Product"}
          </h3>

          <div className="space-y-3">
            <input
              placeholder="Product Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border border-gray-300 rounded-md p-2 w-full focus:border-[var(--color-primary)]"
            />

            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="input input-bordered w-full border-gray-300 rounded-md p-2 focus:border-[var(--color-primary)]"
            >
              <option value="">Select Category</option>
              {categories.map((c) => (
                <option key={String(c.id ?? c._id)} value={String(c.id ?? c._id)}>
                  {c.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Purchase Price"
              value={form.purchasePrice}
              onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
              className="border border-gray-300 rounded-md p-2 w-full focus:border-[var(--color-primary)]"
            />

            <input
              type="number"
              placeholder="Selling Price"
              value={form.sellingPrice}
              onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
              className="border border-gray-300 rounded-md p-2 w-full focus:border-[var(--color-primary)]"
            />

            <input
              type="number"
              placeholder="Tax Rate"
              value={form.taxRate}
              onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
              className="border border-gray-300 rounded-md p-2 w-full focus:border-[var(--color-primary)]"
            />
            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="border border-gray-300 rounded-md p-2 w-full focus:border-[var(--color-primary)]"
            />
          </div>

          <div className="flex justify-end gap-3 mt-5">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-100">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-md bg-[var(--color-primary)] text-white hover:bg-blue-700">
              {editData ? "Update" : "Add"}
            </button>
          </div>
        </motion.form>
      </motion.div>
    </AnimatePresence>
  );
}

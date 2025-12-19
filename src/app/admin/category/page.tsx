"use client";

import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  fetchCategories,
  addCategory,
  updateCategory,
  deleteCategory,
} from "@/store/categorySlice";
import Swal from "sweetalert2";
import { motion, AnimatePresence } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import { AppDispatch, RootState } from "@/store/store";
import "swiper/css";
import "swiper/css/navigation";

interface CategoryType {
  _id: string;
  name: string;
  description?: string | null;
}

export default function Category() {
  const dispatch = useDispatch<AppDispatch>();
  // Tell TS what shape `state.category` has so categories is typed properly
  const { categories, loading } = useSelector(
    (state: RootState) =>
      state.category as { categories: CategoryType[]; loading: boolean }
  );

  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  const handleSubmit = async () => {
    if (!name.trim()) return Swal.fire("Error", "Name is required", "error");
    try {
      if (editId) {
        // keeping logic same — note: parseInt on a Mongo _id may be NaN, but I didn't change your logic
        await dispatch(
          updateCategory({ id: parseInt(editId), name, description })
        ).unwrap();
        Swal.fire("Success", "Category updated", "success");
        setEditId(null);
      } else {
        await dispatch(addCategory({ name, description })).unwrap();
        Swal.fire("Success", "Category added", "success");
      }
      setName("");
      setDescription("");
    } catch (err: unknown) {
      Swal.fire("Error", (err as Error).message || "Something went wrong", "error");
    }
  };

  const handleEdit = (cat: CategoryType) => {
    setEditId(cat._id);
    setName(cat.name);
    setDescription(cat.description ?? "");
  };

  const handleDelete = (id: string) => {
    Swal.fire({
      title: "Are you sure?",
      text: "This will delete the category",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "var(--color-primary)",
      cancelButtonColor: "var(--color-error)",
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        const numericId = Number(id);
        if (Number.isNaN(numericId)) {
          return Swal.fire("Error", "Invalid category id", "error");
        }

        try {
          await dispatch(deleteCategory(numericId)).unwrap();
          Swal.fire("Deleted!", "Category deleted.", "success");
        } catch (err: unknown) {
          Swal.fire("Error", (err as Error).message || "Delete failed", "error");
        }
      }
    });
  };


  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* ================= HEADER ================= */}
      <div className="mb-8 flex flex-col gap-2">
        <h1
          className="text-3xl font-extrabold tracking-tight"
          style={{ color: "var(--color-sidebar)" }}
        >
          Category Management
        </h1>
        <p
          className="text-sm"
          style={{ color: "var(--color-sidebar)", opacity: 0.7 }}
        >
          Organize products by category. Create, update and manage categories used
          across inventory and billing.
        </p>
      </div>

      {/* ================= FORM CARD ================= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 rounded-2xl border bg-[var(--color-white)] p-6 shadow-sm"
        style={{ borderColor: "var(--color-secondary)" }}
      >
        <div className="mb-4">
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--color-sidebar)" }}
          >
            {editId ? "Edit Category" : "Create Category"}
          </h2>
          <p
            className="text-xs"
            style={{ color: "var(--color-sidebar)", opacity: 0.6 }}
          >
            Categories help group products for inventory & billing.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-sidebar)]">
              Category Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Medicines"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{
                borderColor: "var(--color-secondary)",
              }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-sidebar)]">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{
                borderColor: "var(--color-secondary)",
              }}
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSubmit}
            className="rounded-lg px-5 py-2 text-sm font-semibold shadow-sm transition hover:brightness-95"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "var(--color-white)",
            }}
          >
            {editId ? "Update Category" : "Add Category"}
          </button>

          {editId && (
            <button
              onClick={() => {
                setEditId(null);
                setName("");
                setDescription("");
              }}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-neutral)]"
              style={{ borderColor: "var(--color-secondary)" }}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </motion.div>

      {/* ================= LIST ================= */}
      {loading ? (
        <div
          className="py-12 text-center text-sm"
          style={{ color: "var(--color-sidebar)", opacity: 0.7 }}
        >
          Loading categories…
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {categories.map((cat) => (
              <motion.div
                key={cat._id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group rounded-2xl border bg-[var(--color-white)] p-5 shadow-sm transition hover:shadow-md"
                style={{ borderColor: "var(--color-secondary)" }}
              >
                <div className="mb-3">
                  <h3
                    className="text-lg font-semibold"
                    style={{ color: "var(--color-sidebar)" }}
                  >
                    {cat.name}
                  </h3>
                  <p
                    className="mt-1 text-sm"
                    style={{
                      color: "var(--color-sidebar)",
                      opacity: 0.7,
                    }}
                  >
                    {cat.description || "No description"}
                  </p>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleEdit(cat)}
                    className="rounded-full border border-[var(--color-primary)] px-3 py-1 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-white)] transition"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => handleDelete(cat._id)}
                    className="rounded-full border border-[var(--color-error)] px-3 py-1 text-xs font-medium text-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-[var(--color-white)] transition"
                   
                  >
                    Delete
                  </button>
                </div>

              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

}

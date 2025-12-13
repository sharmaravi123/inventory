"use client";

import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/store/store";
import { fetchProducts } from "@/store/productSlice";
import { fetchCategories } from "@/store/categorySlice";
import ProductTable from "../components/product/ProductTable";

export default function ProductPage() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(fetchProducts());
    dispatch(fetchCategories());
  }, [dispatch]);

  return (
    <main className="min-h-screen bg-[var(--color-neutral)] p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-neutral)] bg-[var(--color-white)] px-3 py-1 text-xs font-medium text-[var(--color-primary)] shadow-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-success)]" />
              Product & Pricing
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-sidebar)]">
              Product Inventory
            </h1>
            <p
              className="text-sm md:text-base"
              style={{ color: "var(--color-sidebar)", opacity: 0.7 }}
            >
              Manage products, categories, tax and per-box quantities from a single place.
            </p>
          </div>
        </header>

        <ProductTable />
      </div>
    </main>
  );
}

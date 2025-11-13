"use client";

import React, { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import TableRow from "./TableRow";
import SearchAndFilters from "./SearchAndFilters";
import ProductForm, { Category, ProductEditData } from "./ProductForm"; // import the ProductEditData type

// Product shape compatible with ProductEditData
interface Product {
  id: string | number;
  name?: string;
  sku?: string;
  category?: { id?: string | number; _id?: string; name?: string } | string | number | null;
  categoryId?: string | number | null;
  purchasePrice?: number;
  sellingPrice?: number;
  description?: string;
  taxRate?: number;
  [key: string]: unknown;
}

export default function ProductTable(): React.ReactElement {
  const { products, loading } = useSelector((state: RootState) => state.product);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editData, setEditData] = useState<ProductEditData | undefined>(undefined);

  // For search and category filter
  const [search, setSearch] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");

  const productList = (products ?? []) as Product[];

  const filteredProducts = productList.filter((p) => {
    const matchesSearch =
      (p.name ?? "").toString().toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? "").toString().toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      !categoryId ||
      String(p.categoryId ?? (typeof p.category === "object" ? (p.category as Category)?._id ?? (p.category as Category)?.id ?? "" : p.category ?? "")) ===
        categoryId;
    return matchesSearch && matchesCategory;
  });

  // Note: parameter typed as Product so TableRow and ProductTable remain consistent
  const handleEdit = (product: Product) => {
    // Map Product -> ProductEditData shape (it's structurally compatible)
    const mapped: ProductEditData = {
      id: product.id,
      name: product.name,
      category: product.category ?? product.categoryId ?? undefined,
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      description: product.description,
      taxRate: product.taxRate as number | undefined,
    };
    setEditData(mapped);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setEditData(undefined);
    setShowForm(false);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Product Inventory</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-md bg-[var(--color-primary)] text-white hover:bg-[var(--color-secondary)] transition-all"
        >
          Add Product
        </button>
      </div>

      <SearchAndFilters search={search} setSearch={setSearch} categoryId={categoryId} setCategoryId={setCategoryId} />

      <div className="overflow-hidden rounded-xl border bg-white">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : (
          <div className="relative w-full overflow-x-auto rounded-md  mt-4">
            <table className="min-w-[700px] w-full text-sm text-left border-collapse">
              <thead className="bg-gray-50 text-gray-500 text-sm">
                <tr>
                  <th className="p-4  min-w-[160px] text-left">SKU</th>
                  <th className="p-4  min-w-[100px] text-left">Name</th>
                  <th className="p-4  min-w-[100px] text-left">Category</th>
                  <th className="p-4  min-w-[100px] text-left">Purchase</th>
                  <th className="p-4  min-w-[100px] text-left">Selling</th>
                  <th className="p-4  min-w-[80px] text-left">Tax Rate</th>
                  <th className="p-4  min-w-[120px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <TableRow key={String(p.id)} product={p} onEdit={handleEdit} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && <ProductForm onClose={handleCloseForm} editData={editData} />}
    </section>
  );
}

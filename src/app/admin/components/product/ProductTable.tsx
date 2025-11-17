"use client";

import React, { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import TableRow from "./TableRow";
import SearchAndFilters from "./SearchAndFilters";
import ProductForm, { ProductEditData } from "./ProductForm";
import type { ProductType } from "@/store/productSlice"; // <- use the redux type

// A category value coming from product may be:
// - a string id,
// - a number id,
// - an object with {_id, id, name}
// - null/undefined
type MaybeCategory =
  | string
  | number
  | { _id?: string | number; id?: string | number; name?: string }
  | null
  | undefined;

/** Safely convert a possible id-like value to a string */
function idToString(id: unknown): string {
  if (id == null) return "";
  if (typeof id === "string" || typeof id === "number") return String(id);
  // object case: try common fields
  if (typeof id === "object") {
    const obj = id as { _id?: unknown; id?: unknown };
    const candidate = obj._id ?? obj.id ?? "";
    return candidate == null ? "" : String(candidate);
  }
  return String(id);
}

export default function ProductTable(): React.ReactElement {
  const { products, loading } = useSelector((state: RootState) => state.product);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editData, setEditData] = useState<ProductEditData | undefined>(undefined);

  // For search and category filter
  const [search, setSearch] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");

  // Use the ProductType from the slice (no unsafe casts)
  const productList: ProductType[] = (products ?? []) as ProductType[];

  // helper to extract category id string from product (consistent comparison)
  function extractProductCategoryId(p: ProductType): string {
    // p.categoryId may be string/object/number
    if (p.categoryId != null) {
      return idToString(p.categoryId as unknown);
    }

    // p.category may be object or primitive
    const cat = (p as unknown as { category?: MaybeCategory }).category;
    if (cat != null) return idToString(cat);

    return "";
  }

  const filteredProducts = productList.filter((p) => {
    const name = (p.name ?? "").toString().toLowerCase();
    const sku = (p.sku ?? "").toString().toLowerCase();
    const matchesSearch =
      name.includes(search.toLowerCase()) || sku.includes(search.toLowerCase());

    const pCatId = extractProductCategoryId(p);

    // Debug: uncomment to inspect comparisons in console
    // console.log("compare:", { productId: p.id, pCatId, selectedCategoryId: categoryId });

    const matchesCategory = !categoryId || pCatId === categoryId;

    return matchesSearch && matchesCategory;
  });

  // Note: parameter typed as ProductType so TableRow and ProductTable remain consistent
  const handleEdit = (product: ProductType) => {
    const mapped: ProductEditData = {
      id: product.id,
      name: product.name,
      category: (product.category ?? product.categoryId) as unknown as ProductEditData["category"],
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      description: product.description,
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

      <SearchAndFilters
        search={search}
        setSearch={setSearch}
        categoryId={categoryId}
        setCategoryId={setCategoryId}
      />

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
                  <th className="p-4  min-w-[120px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <TableRow key={String(p.id)} product={p as unknown as any} onEdit={handleEdit as any} />
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

"use client";

import React, { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import TableRow from "./TableRow";
import SearchAndFilters from "./SearchAndFilters";
import ProductForm, { ProductEditData } from "./ProductForm";
import type { ProductType } from "@/store/productSlice";

type MaybeCategory =
  | string
  | number
  | { _id?: string | number; id?: string | number; name?: string }
  | null
  | undefined;

function idToString(id: unknown): string {
  if (id == null) return "";
  if (typeof id === "string" || typeof id === "number") return String(id);
  if (typeof id === "object") {
    const obj = id as { _id?: unknown; id?: unknown };
    const candidate = obj._id ?? obj.id ?? "";
    return candidate == null ? "" : String(candidate);
  }
  return String(id);
}

type ProductWithExtras = ProductType & {
  taxPercent?: number | null;
  perBoxItem?: number | null;
  hsnCode?: string | null;
};

export default function ProductTable(): React.ReactElement {
  const { products, loading } = useSelector((state: RootState) => state.product);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editData, setEditData] = useState<ProductEditData | undefined>(undefined);

  const [search, setSearch] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");

  const productList: ProductWithExtras[] = (products ?? []) as ProductWithExtras[];

  function extractProductCategoryId(p: ProductWithExtras): string {
    if (p.categoryId != null) {
      return idToString(p.categoryId as unknown);
    }

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
    const matchesCategory = !categoryId || pCatId === categoryId;

    return matchesSearch && matchesCategory;
  });

  const handleEdit = (product: ProductWithExtras) => {
    const mapped: ProductEditData = {
      id: product.id,
      name: product.name,
      category: (product.category ?? product.categoryId) as ProductEditData["category"],
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      description: product.description,
      taxPercent:
        typeof product.taxPercent === "number" ? product.taxPercent : undefined,
      perBoxItem:
        typeof product.perBoxItem === "number" ? product.perBoxItem : undefined,
        hsnCode: product.hsnCode ?? "", 
    };
    setEditData(mapped);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setEditData(undefined);
    setShowForm(false);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-sidebar)]">
            Products
          </h2>
          <p
            className="text-xs"
            style={{ color: "var(--color-sidebar)", opacity: 0.7 }}
          >
            Keep pricing, tax and per-box quantity accurate for billing.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-white)] shadow-sm hover:brightness-95 transition"
        >
          + Add Product
        </button>
      </div>

      <div className="rounded-xl border border-[var(--color-neutral)] bg-[var(--color-white)] p-4 shadow-sm space-y-3">
        <SearchAndFilters
          search={search}
          setSearch={setSearch}
          categoryId={categoryId}
          setCategoryId={setCategoryId}
        />

        <div className="overflow-hidden rounded-xl border border-[var(--color-neutral)] bg-[var(--color-white)]">
          {loading ? (
            <div
              className="p-6 text-center text-sm"
              style={{ color: "var(--color-sidebar)", opacity: 0.7 }}
            >
              Loading products…
            </div>
          ) : (
            <div className="relative mt-0 w-full overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead className="bg-[var(--color-neutral)] text-xs uppercase tracking-wide">
                  <tr className="text-[var(--color-sidebar)] opacity-80">
                    <th className="p-3 min-w-[120px] text-left">SKU</th>
                    <th className="p-3 min-w-[160px] text-left">Name</th>
                     <th className="p-3 min-w-[120px] text-left">HSN</th>
                    <th className="p-3 min-w-[140px] text-left">Category</th>
                    <th className="p-3 min-w-[100px] text-right">Purchase</th>
                    <th className="p-3 min-w-[100px] text-right">Selling</th>
                    <th className="p-3 min-w-[90px] text-right">Tax %</th>
                    <th className="p-3 min-w-[110px] text-right">Per Box</th>
                    <th className="p-3 min-w-[120px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-6 text-center text-sm"
                        style={{ color: "var(--color-secondary)" }}
                      >
                        No products found. Try changing filters or add a new product.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => (
                      <TableRow
                        key={String(p.id)}
                        product={p}
                        onEdit={handleEdit}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && <ProductForm onClose={handleCloseForm} editData={editData} />}
    </section>
  );
}

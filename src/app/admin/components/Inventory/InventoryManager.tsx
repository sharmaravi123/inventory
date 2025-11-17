"use client";

import React, { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import { RootState, AppDispatch } from "@/store/store";
import {
  fetchInventory,
  addInventory,
  updateInventory,
  deleteInventory,
  InventoryItem,
} from "@/store/inventorySlice";
import { fetchProducts } from "@/store/productSlice";
import { fetchWarehouses } from "@/store/warehouseSlice";
import { X } from "lucide-react";

/**
 * Local types (named uniquely to avoid clashes with other files)
 */
interface ProductType {
  _id?: string;
  id?: string | number;
  name?: string;
  stableKey?: string;
}

interface WarehouseType {
  _id?: string;
  id?: string | number;
  name?: string;
  stableKey?: string;
}

/**
 * InventoryForm shape used by local form state
 */
interface InventoryForm {
  _id?: string;
  productId: string;
  warehouseId: string;
  boxes: number;
  itemsPerBox: number;
  looseItems: number;
  lowStockBoxes?: number;
  lowStockItems?: number;
  tax: number;
}

/**
 * Inventory items returned by API can be either:
 * - plain (referencing productId / warehouseId)
 * - or populated (having product / warehouse objects)
 * Combine them in a single type for safe handling.
 */
type PopulatedRef = { _id?: string; id?: string | number; name?: string };

type InvWithPopulated = InventoryItem & {
  product?: ProductType | PopulatedRef;
  warehouse?: WarehouseType | PopulatedRef;
};

// We intentionally don't set concrete color values here.
// The component should use your global CSS variables (e.g. var(--color-primary)).
const cssVarsStyle: React.CSSProperties = {};

// Safely extract an id string from multiple shapes without using `any`.
function extractIdFromRef(ref: unknown): string | undefined {
  if (ref === undefined || ref === null) return undefined;
  if (typeof ref === "string" || typeof ref === "number") return String(ref);
  if (typeof ref === "object") {
    const obj = ref as Record<string, unknown>;
    const candidate = obj._id ?? obj.id;
    if (typeof candidate === "string" || typeof candidate === "number") return String(candidate);
  }
  return undefined;
}

export default function InventoryManager(): JSX.Element {
  const dispatch = useDispatch<AppDispatch>();

  // typed selectors
  const items = useSelector((s: RootState) => s.inventory.items) as InventoryItem[] | undefined;
  const loading = useSelector((s: RootState) => s.inventory.loading) as boolean;
  const rawProducts = useSelector((s: RootState) => s.product.products ?? []) as ProductType[];
  const rawWarehouses = useSelector((s: RootState) => s.warehouse.list ?? []) as WarehouseType[];

  // Create stable lists with stableKey for React keys
  const products: ProductType[] = rawProducts.map((p, i) => ({ ...p, stableKey: String(p._id ?? p.id ?? `p-${i}`) }));
  const warehouses: WarehouseType[] = rawWarehouses.map((w, i) => ({ ...w, stableKey: String(w._id ?? w.id ?? `w-${i}`) }));

  const [search, setSearch] = useState<string>("");
  const [filterWarehouse, setFilterWarehouse] = useState<string>("");
  const [filterProduct, setFilterProduct] = useState<string>("");
  const [stockFilter, setStockFilter] = useState<"all" | "stock" | "low stock" | "out of stock">("all");

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [form, setForm] = useState<InventoryForm>({
    productId: "",
    warehouseId: "",
    boxes: 0,
    itemsPerBox: 1,
    looseItems: 0,
    lowStockBoxes: 0,
    lowStockItems: 0,
    tax: 0,
  });

  useEffect(() => {
    dispatch(fetchInventory());
    dispatch(fetchProducts());
    dispatch(fetchWarehouses());
  }, [dispatch]);

  // Helpers to resolve a product/warehouse name whether populated or by id
  const getProductName = useCallback((inv: InvWithPopulated): string => {
    if (inv.product && typeof inv.product === "object" && "name" in inv.product && inv.product.name) return String(inv.product.name);
    const pid = extractIdFromRef(inv.productId ?? inv.product ?? undefined);
    if (!pid) return "—";
    const p = products.find((x) => String(x._id ?? x.id) === pid);
    return p?.name ?? pid;
  }, [products]);

  const getWarehouseName = useCallback((inv: InvWithPopulated): string => {
    if (inv.warehouse && typeof inv.warehouse === "object" && "name" in inv.warehouse && inv.warehouse.name) return String(inv.warehouse.name);
    const wid = extractIdFromRef(inv.warehouseId ?? inv.warehouse ?? undefined);
    if (!wid) return "—";
    const w = warehouses.find((x) => String(x._id ?? x.id) === wid);
    return w?.name ?? wid;
  }, [warehouses]);

  // filter & search use resolved names now
  const filteredItems = useMemo(() => {
    const list = items ?? [];
    return list.filter((inv) => {
      const total = inv.boxes * inv.itemsPerBox + inv.looseItems;
      const productName = getProductName(inv).toLowerCase();
      const warehouseName = getWarehouseName(inv).toLowerCase();

      const invPid = extractIdFromRef(inv.productId ?? inv.product ?? undefined) ?? "";
      const invWid = extractIdFromRef(inv.warehouseId ?? inv.warehouse ?? undefined) ?? "";

      const matchesProduct = filterProduct ? invPid === String(filterProduct) : true;
      const matchesWarehouse = filterWarehouse ? invWid === String(filterWarehouse) : true;
      const matchesSearch = search
        ? productName.includes(search.toLowerCase()) || warehouseName.includes(search.toLowerCase())
        : true;

      let matchesStock = true;
      if (stockFilter === "out of stock") matchesStock = total === 0;
      if (stockFilter === "low stock") {
        const lowTotal = (inv.lowStockBoxes ?? 0) * inv.itemsPerBox + (inv.lowStockItems ?? 0);
        matchesStock = total > 0 && total <= lowTotal;
      }
      if (stockFilter === "stock") {
        const lowTotal = (inv.lowStockBoxes ?? 0) * inv.itemsPerBox + (inv.lowStockItems ?? 0);
        matchesStock = total > lowTotal;
      }
      return matchesProduct && matchesWarehouse && matchesSearch && matchesStock;
    });
  }, [items, search, filterProduct, filterWarehouse, stockFilter, getProductName, getWarehouseName]);

  const openAdd = (): void => {
    setForm({
      productId: "",
      warehouseId: "",
      boxes: 0,
      itemsPerBox: 1,
      looseItems: 0,
      lowStockBoxes: 0,
      lowStockItems: 0,
      tax: 0,
    });
    setModalOpen(true);
  };

  const openEdit = (inv: InvWithPopulated): void => {
    const pId = extractIdFromRef(inv.product ?? inv.productId) ?? "";
    const wId = extractIdFromRef(inv.warehouse ?? inv.warehouseId) ?? "";
    setForm({
      _id: inv._id,
      productId: pId,
      warehouseId: wId,
      boxes: inv.boxes,
      itemsPerBox: inv.itemsPerBox,
      looseItems: inv.looseItems,
      lowStockBoxes: inv.lowStockBoxes ?? 0,
      lowStockItems: inv.lowStockItems ?? 0,
      tax: inv.tax ?? 0,
    });
    setModalOpen(true);
  };

  const normalizeLooseToBoxes = (boxes: number, itemsPerBox: number, looseItems: number) => {
    if (itemsPerBox <= 0) itemsPerBox = 1;
    if (looseItems >= itemsPerBox) {
      const extra = Math.floor(looseItems / itemsPerBox);
      boxes += extra;
      looseItems = looseItems % itemsPerBox;
    }
    return { boxes, looseItems } as { boxes: number; looseItems: number };
  };

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e?.preventDefault();

    // for create, productId & warehouseId must be present
    if (!form._id && (!form.productId || !form.warehouseId)) {
      Swal.fire("Error", "Please select product and warehouse", "error");
      return;
    }

    const normalized = normalizeLooseToBoxes(form.boxes, form.itemsPerBox, form.looseItems);

    const createPayload = {
      productId: form.productId,
      warehouseId: form.warehouseId,
      boxes: normalized.boxes,
      itemsPerBox: form.itemsPerBox,
      looseItems: normalized.looseItems,
      lowStockBoxes: form.lowStockBoxes ?? 0,
      lowStockItems: form.lowStockItems ?? 0,
      tax: form.tax,
    };

    const updatePayload = {
      boxes: normalized.boxes,
      itemsPerBox: form.itemsPerBox,
      looseItems: normalized.looseItems,
      lowStockBoxes: form.lowStockBoxes ?? 0,
      lowStockItems: form.lowStockItems ?? 0,
      tax: form.tax,
    };

    try {
      if (form._id) {
        // update: do NOT change productId/warehouseId
        await dispatch(updateInventory({ id: form._id, data: updatePayload })).unwrap();
        Swal.fire("Updated", "Stock updated successfully", "success");
      } else {
        await dispatch(addInventory(createPayload)).unwrap();
        Swal.fire("Added", "Stock created successfully", "success");
      }
      setModalOpen(false);
      dispatch(fetchInventory());
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      Swal.fire("Error", e?.message || "Operation failed", "error");
    }
  };

  const handleDelete = (id?: string): void => {
    if (!id) return;
    Swal.fire({
      title: "Delete stock?",
      text: "This action cannot be undone",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#F05454",
      cancelButtonColor: "#A7C7E7",
      confirmButtonText: "Yes, delete",
    }).then((res) => {
      if (res.isConfirmed) dispatch(deleteInventory(id));
    });
  };

  const handleEditClick = (inv: InvWithPopulated): void => openEdit(inv);

  const getStatusColor = (inv: InvWithPopulated): string => {
    const total = inv.boxes * inv.itemsPerBox + inv.looseItems;
    const lowTotal = (inv.lowStockBoxes ?? 0) * inv.itemsPerBox + (inv.lowStockItems ?? 0);
    if (total === 0) return "var(--color-error)";
    if (total <= lowTotal) return "var(--color-warning)";
    return "var(--color-success)";
  };

  return (
    <div style={cssVarsStyle} className="min-h-screen p-6 bg-[var(--color-neutral)]">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-[var(--color-sidebar)]">Inventory Manager</h1>
            <p className="text-sm text-gray-600">Add new stock or edit quantities (product/warehouse are immutable after create).</p>
          </div>

          <div className="flex gap-3 items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product / warehouse"
              className="px-3 py-2 rounded border w-56"
            />
            <button onClick={openAdd} className="px-4 py-2 rounded bg-[var(--color-primary)] text-white hover:brightness-95">Add Stock</button>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <select value={filterWarehouse} onChange={(e) => setFilterWarehouse(e.target.value)} className="p-2 border rounded">
                <option value="">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.stableKey} value={String(w._id ?? w.id)}>{w.name}</option>
                ))}
              </select>
              <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} className="p-2 border rounded">
                <option value="">All Products</option>
                {products.map((p) => (
                  <option key={p.stableKey} value={String(p._id ?? p.id)}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">
              {loading ? (
                <div className="py-8 text-center text-gray-500">Loading...</div>
              ) : (
                <table className="min-w-[900px] w-full table-auto text-sm md:text-base">
                  <thead className="bg-[var(--color-neutral)] text-[var(--color-sidebar)]">
                    <tr>
                      <th className="py-3 px-3 text-left whitespace-nowrap">Product</th>
                      <th className="py-3 px-3 text-left whitespace-nowrap">Warehouse</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">Boxes</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">Items/Box</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">Loose</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">Tax</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">Total</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">Status</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((inv) => {
                      const total = inv.boxes * inv.itemsPerBox + inv.looseItems;
                      const lowTotal = (inv.lowStockBoxes ?? 0) * inv.itemsPerBox + (inv.lowStockItems ?? 0);
                      const prodName = getProductName(inv);
                      const whName = getWarehouseName(inv);
                      const keyId = inv._id ?? String((inv as unknown as { id?: string | number }).id ?? `${Math.random()}`);

                      return (
                        <tr key={keyId} className="border-t hover:bg-[var(--color-neutral)] transition capitalize">
                          <td className="py-3 px-3 font-medium whitespace-nowrap">{prodName ?? "—"}</td>
                          <td className="py-3 px-3 font-medium whitespace-nowrap">{whName ?? "—"}</td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">{inv.boxes}</td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">{inv.itemsPerBox}</td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">{inv.looseItems}</td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">{inv.tax}</td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">{total}</td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="px-2 py-1 rounded text-white text-xs md:text-sm" style={{ backgroundColor: getStatusColor(inv) }}>
                              {total === 0 ? "Out of Stock" : total <= lowTotal ? "Low Stock" : "In Stock"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex flex-wrap justify-center gap-2">
                              <button onClick={() => handleEditClick(inv)} className="px-3 py-1 rounded bg-[var(--color-primary)] text-white hover:opacity-90">Edit</button>
                              <button onClick={() => handleDelete(inv._id)} className="px-3 py-1 rounded bg-[var(--color-error)] text-white hover:opacity-90">Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow">
              <h3 className="font-semibold text-[var(--color-sidebar)]">Overview</h3>
              <div className="mt-3">
                <div>
                  Total items: {" "}
                  <strong>
                    {(items ?? []).reduce((acc: number, i: InventoryItem) => acc + (i.boxes * i.itemsPerBox + i.looseItems), 0)}
                  </strong>
                </div>
                <div className="text-sm text-gray-500 mt-1">Warehouses: {warehouses.length}</div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow">
              <h3 className="font-semibold">Filters</h3>
              <div className="mt-3 flex flex-col gap-2">
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as "all" | "stock" | "low stock" | "out of stock")}
                  className="p-2 border rounded"
                >
                  <option value="all">All</option>
                  <option value="stock">Stock</option>
                  <option value="low stock">Low stock</option>
                  <option value="out of stock">Out of stock</option>
                </select>
                <button
                  onClick={() => {
                    setSearch("");
                    setFilterProduct("");
                    setFilterWarehouse("");
                    setStockFilter("all");
                  }}
                  className="px-3 py-2 rounded bg-[var(--color-secondary)] text-[var(--color-sidebar)]"
                >
                  Reset
                </button>
              </div>
            </div>
          </aside>
        </section>

        <AnimatePresence>
          {modalOpen && (
            <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />

              <motion.form
                onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }}
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                className="relative bg-white w-full max-w-2xl rounded-xl p-6 shadow-2xl z-10"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{form._id ? "Edit Stock" : "Add Stock"}</h3>
                  <button type="button" onClick={() => setModalOpen(false)} className="p-2 rounded hover:bg-slate-100"><X /></button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* If creating: allow selecting product & warehouse. If editing: show readonly labels (no selects). */}
                  {form._id ? (
                    <>
                      <div>
                        <label className="text-sm text-gray-600">Product (immutable)</label>
                        <div className="w-full border rounded px-3 py-2 bg-gray-50 text-sm">
                          {products.find((p) => String(p._id ?? p.id) === form.productId)?.name ?? form.productId}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">Warehouse (immutable)</label>
                        <div className="w-full border rounded px-3 py-2 bg-gray-50 text-sm">
                          {warehouses.find((w) => String(w._id ?? w.id) === form.warehouseId)?.name ?? form.warehouseId}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm text-gray-600">Product</label>
                        <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="w-full border rounded px-3 py-2">
                          <option value="">Choose product</option>
                          {products.map((p) => <option key={p.stableKey} value={String(p._id ?? p.id)}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">Warehouse</label>
                        <select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} className="w-full border rounded px-3 py-2">
                          <option value="">Choose warehouse</option>
                          {warehouses.map((w) => <option key={w.stableKey} value={String(w._id ?? w.id)}>{w.name}</option>)}
                        </select>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-sm text-gray-600">Boxes</label>
                    <input type="number" min={0} value={form.boxes} onChange={(e) => setForm({ ...form, boxes: Number(e.target.value) })} className="w-full border rounded px-3 py-2" />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">Items / Box</label>
                    <input type="number" min={1} value={form.itemsPerBox} onChange={(e) => setForm({ ...form, itemsPerBox: Math.max(1, Number(e.target.value)) })} className="w-full border rounded px-3 py-2" />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">Loose Items</label>
                    <input type="number" min={0} value={form.looseItems} onChange={(e) => setForm({ ...form, looseItems: Math.max(0, Number(e.target.value)) })} className="w-full border rounded px-3 py-2" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Tax</label>
                    <input type="number" min={0} value={form.tax} onChange={(e) => setForm({ ...form, tax: Math.max(0, Number(e.target.value)) })} className="w-full border rounded px-3 py-2" />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">Low stock (boxes)</label>
                    <input type="number" min={0} value={form.lowStockBoxes} onChange={(e) => setForm({ ...form, lowStockBoxes: Number(e.target.value) })} className="w-full border rounded px-3 py-2" />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">Low stock (loose)</label>
                    <input type="number" min={0} value={form.lowStockItems} onChange={(e) => setForm({ ...form, lowStockItems: Number(e.target.value) })} className="w-full border rounded px-3 py-2" />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-[var(--color-primary)] text-white rounded">{form._id ? "Update Stock" : "Add Stock"}</button>
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

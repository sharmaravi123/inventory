// src/app/admin/components/inventory/AdminInventoryManager.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import { X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/store/store";
import {
  fetchInventory,
  addInventory,
  updateInventory,
  deleteInventory,
  InventoryItem,
} from "@/store/inventorySlice";
import { fetchProducts } from "@/store/productSlice";
import { fetchWarehouses } from "@/store/warehouseSlice";

type Product = {
  _id?: string | number;
  id?: string | number;
  name?: string;
  purchasePrice?: number;
  sellingPrice?: number;
  price?: number;
  perBoxItem?: number | null;
  taxPercent?: number | null;
  stableKey?: string;
};

type Warehouse = {
  _id?: string | number;
  id?: string | number;
  name?: string;
  stableKey?: string;
};

type FormState = {
  _id?: string;
  productId: string;
  warehouseId: string;
  boxes: number;
  looseItems: number;
  lowStockBoxes: number;
  lowStockItems: number;
};

const AdminInventoryManager: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading } = useSelector(
    (state: RootState) => state.inventory
  );
  const rawProducts = useSelector(
    (state: RootState) => state.product.products ?? []
  ) as Product[];
  const rawWarehouses = useSelector(
    (state: RootState) => state.warehouse.list ?? []
  ) as Warehouse[];

  const products = useMemo(
    () =>
      rawProducts.map((p, i) => ({
        ...p,
        stableKey: String(p._id ?? p.id ?? `p-${i}`),
      })),
    [rawProducts]
  );

  const warehouses = useMemo(
    () =>
      rawWarehouses.map((w, i) => ({
        ...w,
        stableKey: String(w._id ?? w.id ?? `w-${i}`),
      })),
    [rawWarehouses]
  );

  const [search, setSearch] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [stockFilter, setStockFilter] = useState<
    "all" | "stock" | "low stock" | "out of stock"
  >("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    productId: "",
    warehouseId: "",
    boxes: 0,
    looseItems: 0,
    lowStockBoxes: 0,
    lowStockItems: 0,
  });

  useEffect(() => {
    dispatch(fetchProducts());
    dispatch(fetchWarehouses());
    dispatch(fetchInventory());
  }, [dispatch]);

  const extractId = useCallback((ref: unknown): string | undefined => {
    if (ref == null) return undefined;
    if (typeof ref === "string" || typeof ref === "number") {
      return String(ref);
    }
    if (typeof ref === "object") {
      const obj = ref as Record<string, unknown>;
      const candidate = obj._id ?? obj.id;
      if (candidate == null || candidate === "") return undefined;
      return String(candidate);
    }
    return undefined;
  }, []);

  const getProductName = useCallback(
    (inv: InventoryItem): string => {
      const prodObj = (inv as unknown as {
        product?: unknown;
      }).product;
      if (
        prodObj &&
        typeof prodObj === "object" &&
        "name" in prodObj &&
        (prodObj as { name?: unknown }).name
      ) {
        return String((prodObj as { name?: unknown }).name);
      }
      const pid = extractId(inv.productId ?? prodObj) ?? "";
      const p = products.find(
        (x) => String(x._id ?? x.id) === pid
      );
      return p?.name ?? pid ?? "—";
    },
    [products, extractId]
  );

  const getWarehouseName = useCallback(
    (inv: InventoryItem): string => {
      const whObj = (inv as unknown as {
        warehouse?: unknown;
      }).warehouse;
      if (
        whObj &&
        typeof whObj === "object" &&
        "name" in whObj &&
        (whObj as { name?: unknown }).name
      ) {
        return String((whObj as { name?: unknown }).name);
      }
      const wid = extractId(inv.warehouseId ?? whObj) ?? "";
      const w = warehouses.find(
        (x) => String(x._id ?? x.id) === wid
      );
      return w?.name ?? wid ?? "—";
    },
    [warehouses, extractId]
  );

  const getProductPrices = useCallback(
    (productId?: string): { purchase?: number; selling?: number } => {
      if (!productId) return {};
      const p = products.find(
        (x) => String(x._id ?? x.id) === String(productId)
      );
      if (!p) return {};
      const purchase = p.purchasePrice ?? p.price;
      const selling = p.sellingPrice ?? p.price;
      return { purchase, selling };
    },
    [products]
  );

  const getProductPerBox = useCallback(
    (inv: InventoryItem): number => {
      const prodObj = (inv as unknown as {
        product?: unknown;
      }).product;
      const pid = extractId(inv.productId ?? prodObj);
      if (!pid) return 1;
      const p = products.find(
        (x) => String(x._id ?? x.id) === pid
      );
      const perBoxVal =
        p && typeof p.perBoxItem === "number" ? p.perBoxItem : 1;
      return perBoxVal > 0 ? perBoxVal : 1;
    },
    [products, extractId]
  );

  const getProductTaxPercent = useCallback(
    (inv: InventoryItem): number | null => {
      const prodObj = (inv as unknown as {
        product?: unknown;
      }).product;
      const pid = extractId(inv.productId ?? prodObj);
      if (!pid) return null;
      const p = products.find(
        (x) => String(x._id ?? x.id) === pid
      );
      if (!p || typeof p.taxPercent !== "number") return null;
      return p.taxPercent;
    },
    [products, extractId]
  );

  const currency = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
      }),
    []
  );

  const filteredItems = useMemo(() => {
    return items.filter((inv) => {
      const perBox = getProductPerBox(inv);
      const total =
        inv.boxes * perBox + inv.looseItems;

      const pname = getProductName(inv).toLowerCase();
      const wname = getWarehouseName(inv).toLowerCase();
      const pid = extractId(
        (inv as InventoryItem).productId ??
          (inv as unknown as { product?: unknown }).product
      ) ?? "";
      const wid = extractId(
        (inv as InventoryItem).warehouseId ??
          (inv as unknown as { warehouse?: unknown }).warehouse
      ) ?? "";

      if (filterProduct && pid !== String(filterProduct)) {
        return false;
      }
      if (filterWarehouse && wid !== String(filterWarehouse)) {
        return false;
      }
      if (
        search &&
        !(`${pname} ${wname}`).includes(search.toLowerCase())
      ) {
        return false;
      }

      const lowTotal =
        (inv.lowStockBoxes ?? 0) * perBox +
        (inv.lowStockItems ?? 0);

      if (stockFilter === "out of stock") return total === 0;
      if (stockFilter === "low stock") {
        return total > 0 && total <= lowTotal;
      }
      if (stockFilter === "stock") {
        return total > lowTotal;
      }
      return true;
    });
  }, [
    items,
    search,
    filterProduct,
    filterWarehouse,
    stockFilter,
    getProductName,
    getWarehouseName,
    extractId,
    getProductPerBox,
  ]);

  const totalItemsCount = useMemo(
    () =>
      items.reduce((acc, inv) => {
        const perBox = getProductPerBox(inv);
        const total =
          inv.boxes * perBox + inv.looseItems;
        return acc + total;
      }, 0),
    [items, getProductPerBox]
  );

  const statusColor = useCallback(
    (inv: InventoryItem) => {
      const perBox = getProductPerBox(inv);
      const total =
        inv.boxes * perBox + inv.looseItems;
      const lowTotal =
        (inv.lowStockBoxes ?? 0) * perBox +
        (inv.lowStockItems ?? 0);

      if (total === 0) return "var(--color-error)";
      if (total <= lowTotal) return "var(--color-warning)";
      return "var(--color-success)";
    },
    [getProductPerBox]
  );

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!form._id && (!form.productId || !form.warehouseId)) {
      void Swal.fire(
        "Error",
        "Please select product and warehouse",
        "error"
      );
      return;
    }

    const createPayload = {
      productId: form.productId,
      warehouseId: form.warehouseId,
      boxes: form.boxes,
      looseItems: form.looseItems,
      lowStockBoxes: form.lowStockBoxes ?? 0,
      lowStockItems: form.lowStockItems ?? 0,
    } as const;

    const updatePayload = {
      boxes: form.boxes,
      looseItems: form.looseItems,
      lowStockBoxes: form.lowStockBoxes ?? 0,
      lowStockItems: form.lowStockItems ?? 0,
    } as const;

    try {
      if (form._id) {
        await dispatch(
          updateInventory({ id: form._id, data: updatePayload })
        ).unwrap();
        await Swal.fire(
          "Updated",
          "Stock updated successfully",
          "success"
        );
      } else {
        await dispatch(addInventory(createPayload)).unwrap();
        await Swal.fire(
          "Added",
          "Stock created successfully",
          "success"
        );
      }
      setModalOpen(false);
      void dispatch(fetchInventory());
    } catch (err) {
      const errorObj =
        err instanceof Error ? err : new Error(String(err));
      void Swal.fire(
        "Error",
        errorObj.message || "Operation failed",
        "error"
      );
    }
  };

  const handleDelete = (id?: string) => {
    if (!id) return;
    void Swal.fire({
      title: "Delete stock?",
      text: "This action cannot be undone",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
    }).then((res) => {
      if (res.isConfirmed) {
        void dispatch(deleteInventory(id));
      }
    });
  };

  const openAdd = () => {
    setForm({
      productId: "",
      warehouseId: "",
      boxes: 0,
      looseItems: 0,
      lowStockBoxes: 0,
      lowStockItems: 0,
    });
    setModalOpen(true);
  };

  const openEdit = (inv: InventoryItem) => {
    setForm({
      _id: inv._id,
      productId:
        extractId(
          (inv as unknown as { product?: unknown }).product ??
            inv.productId
        ) ?? "",
      warehouseId:
        extractId(
          (inv as unknown as { warehouse?: unknown }).warehouse ??
            inv.warehouseId
        ) ?? "",
      boxes: inv.boxes,
      looseItems: inv.looseItems,
      lowStockBoxes: inv.lowStockBoxes ?? 0,
      lowStockItems: inv.lowStockItems ?? 0,
    });
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[var(--color-neutral)] p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto flex max-w-7xl flex-col gap-6"
      >
        {/* HEADER */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-secondary)] bg-[var(--color-white)] px-3 py-1 text-xs font-medium text-[var(--color-primary)] shadow-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-success)]" />
              Admin Inventory Manager
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-sidebar)]">
              Inventory across warehouses
            </h1>
            <p
              className="text-sm md:text-base"
              style={{
                color: "var(--color-sidebar)",
                opacity: 0.7,
              }}
            >
              Quantities only – tax, HSN and per-box details come
              from products.
            </p>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product / warehouse"
              className="w-full rounded-lg border border-[var(--color-secondary)] bg-[var(--color-white)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70 md:w-64"
            />
            <button
              onClick={openAdd}
              className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-white)] shadow-sm hover:brightness-95 transition"
            >
              + Add Stock
            </button>
          </div>
        </header>

        {/* TOP STATS */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--color-secondary)] bg-[var(--color-white)] p-4 shadow-sm">
            <p
              className="text-xs font-medium uppercase tracking-wide"
              style={{
                color: "var(--color-sidebar)",
                opacity: 0.6,
              }}
            >
              Total items
            </p>
            <p className="mt-1 text-2xl font-extrabold text-[var(--color-sidebar)]">
              {totalItemsCount}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--color-secondary)] bg-[var(--color-white)] p-4 shadow-sm">
            <p
              className="text-xs font-medium uppercase tracking-wide"
              style={{
                color: "var(--color-sidebar)",
                opacity: 0.6,
              }}
            >
              Warehouses
            </p>
            <p className="mt-1 text-2xl font-extrabold text-[var(--color-sidebar)]">
              {warehouses.length}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--color-secondary)] bg-[var(--color-white)] p-4 shadow-sm">
            <p
              className="text-xs font-medium uppercase tracking-wide"
              style={{
                color: "var(--color-sidebar)",
                opacity: 0.6,
              }}
            >
              Inventory records
            </p>
            <p className="mt-1 text-2xl font-extrabold text-[var(--color-sidebar)]">
              {items.length}
            </p>
          </div>
        </section>

        {/* FILTER BAR */}
        <section className="rounded-2xl border border-[var(--color-secondary)] bg-[var(--color-white)] p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <select
                value={filterWarehouse}
                onChange={(e) => setFilterWarehouse(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-secondary)] bg-[var(--color-white)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70 md:w-56"
              >
                <option value="">All warehouses</option>
                {warehouses.map((w) => (
                  <option
                    key={w.stableKey}
                    value={String(w._id ?? w.id)}
                  >
                    {w.name}
                  </option>
                ))}
              </select>

              <select
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-secondary)] bg-[var(--color-white)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70 md:w-56"
              >
                <option value="">All products</option>
                {products.map((p) => (
                  <option
                    key={p.stableKey}
                    value={String(p._id ?? p.id)}
                  >
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={stockFilter}
                onChange={(e) =>
                  setStockFilter(
                    e.target.value as
                      | "all"
                      | "stock"
                      | "low stock"
                      | "out of stock"
                  )
                }
                className="w-full rounded-lg border border-[var(--color-secondary)] bg-[var(--color-white)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70 md:w-44"
              >
                <option value="all">All stock</option>
                <option value="stock">In stock</option>
                <option value="low stock">Low stock</option>
                <option value="out of stock">Out of stock</option>
              </select>
            </div>

            <button
              onClick={() => {
                setSearch("");
                setFilterProduct("");
                setFilterWarehouse("");
                setStockFilter("all");
              }}
              className="inline-flex items-center justify-center rounded-lg bg-[var(--color-secondary)] px-4 py-2 text-xs font-semibold text-[var(--color-sidebar)] hover:brightness-95 transition"
            >
              Reset filters
            </button>
          </div>
        </section>

        {/* TABLE FULL WIDTH */}
        <section className="rounded-2xl border border-[var(--color-secondary)] bg-[var(--color-white)] p-4 shadow-sm">
          {loading ? (
            <div
              className="py-8 text-center text-sm"
              style={{
                color: "var(--color-sidebar)",
                opacity: 0.7,
              }}
            >
              Loading inventory…
            </div>
          ) : (
            <div className="relative w-full overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                <thead className="bg-[var(--color-neutral)] text-xs uppercase tracking-wide text-[var(--color-sidebar)]">
                  <tr>
                    <th className="px-3 py-3 text-left">Product</th>
                    <th className="px-3 py-3 text-left">Warehouse</th>
                    <th className="px-3 py-3 text-center">
                      Boxes
                    </th>
                    <th className="px-3 py-3 text-center">
                      Items / box
                    </th>
                    <th className="px-3 py-3 text-center">
                      Loose
                    </th>
                    <th className="px-3 py-3 text-center">
                      Tax %
                    </th>
                    <th className="px-3 py-3 text-center">
                      Total items
                    </th>
                    <th className="px-3 py-3 text-center">
                      Status
                    </th>
                    <th className="px-3 py-3 text-center">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-8 text-center text-sm"
                        style={{
                          color: "var(--color-secondary)",
                        }}
                      >
                        No inventory found. Try changing filters
                        or add a stock record.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((inv) => {
                      const prodName = getProductName(inv);
                      const whName = getWarehouseName(inv);
                      const keyId =
                        inv._id ?? String(Math.random());
                      const pid =
                        extractId(
                          inv.productId ??
                            (inv as unknown as {
                              product?: unknown;
                            }).product
                        ) ?? undefined;
                      const prices = getProductPrices(pid);
                      const perBox = getProductPerBox(inv);
                      const taxPercent =
                        getProductTaxPercent(inv);
                      const total =
                        inv.boxes * perBox + inv.looseItems;
                      const badgeColor = statusColor(inv);

                      return (
                        <tr
                          key={keyId}
                          className="border-t border-[var(--color-neutral)] hover:bg-[var(--color-neutral)] transition-colors"
                        >
                          <td className="px-3 py-3 align-top">
                            <div className="font-medium text-[var(--color-sidebar)]">
                              {prodName ?? "—"}
                            </div>
                            <div
                              className="mt-1 text-[11px]"
                              style={{
                                color: "var(--color-sidebar)",
                                opacity: 0.7,
                              }}
                            >
                              {prices.selling !== undefined && (
                                <span className="mr-3">
                                  Sell:{" "}
                                  {currency.format(
                                    prices.selling
                                  )}
                                </span>
                              )}
                              {prices.purchase !== undefined && (
                                <span>
                                  Buy:{" "}
                                  {currency.format(
                                    prices.purchase
                                  )}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-middle text-[var(--color-sidebar)]">
                            {whName ?? "—"}
                          </td>
                          <td className="px-3 py-3 align-middle text-center text-[var(--color-sidebar)]">
                            {inv.boxes}
                          </td>
                          <td className="px-3 py-3 align-middle text-center text-[var(--color-sidebar)]">
                            {perBox}
                          </td>
                          <td className="px-3 py-3 align-middle text-center text-[var(--color-sidebar)]">
                            {inv.looseItems}
                          </td>
                          <td className="px-3 py-3 align-middle text-center text-[var(--color-sidebar)]">
                            {taxPercent != null
                              ? `${taxPercent.toFixed(2)}%`
                              : "—"}
                          </td>
                          <td className="px-3 py-3 align-middle text-center text-[var(--color-sidebar)]">
                            {total}
                          </td>
                          <td className="px-3 py-3 align-middle text-center">
                            <span
                              className="rounded-full px-3 py-1 text-xs font-semibold text-[var(--color-white)]"
                              style={{
                                backgroundColor: badgeColor,
                              }}
                            >
                              {total === 0
                                ? "Out of stock"
                                : total <=
                                  ((inv.lowStockBoxes ?? 0) *
                                    perBox +
                                    (inv.lowStockItems ?? 0))
                                ? "Low stock"
                                : "In stock"}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-middle text-center">
                            <div className="inline-flex flex-wrap justify-center gap-2">
                              <button
                                onClick={() => openEdit(inv)}
                                className="rounded-full border border-[var(--color-primary)] px-3 py-1 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-white)] transition"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  handleDelete(inv._id)
                                }
                                className="rounded-full border border-[var(--color-error)] px-3 py-1 text-xs font-medium text-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-[var(--color-white)] transition"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* MODAL */}
        <AnimatePresence>
          {modalOpen && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setModalOpen(false)}
              />
              <motion.form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSubmit(e);
                }}
                initial={{ scale: 0.96, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 10 }}
                className="relative z-10 w-full max-w-2xl rounded-2xl border border-[var(--color-secondary)] bg-[var(--color-white)] p-6 shadow-2xl"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-sidebar)]">
                      {form._id ? "Edit stock" : "Add stock"}
                    </h3>
                    <p
                      className="mt-1 text-xs"
                      style={{
                        color: "var(--color-sidebar)",
                        opacity: 0.7,
                      }}
                    >
                      Quantities only — per box items and tax are
                      configured in the product.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-full p-2 hover:bg-[var(--color-neutral)] transition"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4 text-[var(--color-sidebar)]" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {form._id ? (
                    <>
                      <div>
                        <label className="text-xs font-medium text-[var(--color-sidebar)]">
                          Product
                        </label>
                        <div className="mt-1 w-full rounded-lg border border-[var(--color-secondary)] bg-[var(--color-neutral)] px-3 py-2 text-sm text-[var(--color-sidebar)]">
                          {products.find(
                            (p) =>
                              String(p._id ?? p.id) ===
                              form.productId
                          )?.name ?? form.productId}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[var(--color-sidebar)]">
                          Warehouse
                        </label>
                        <div className="mt-1 w-full rounded-lg border border-[var(--color-secondary)] bg-[var(--color-neutral)] px-3 py-2 text-sm text-[var(--color-sidebar)]">
                          {warehouses.find(
                            (w) =>
                              String(w._id ?? w.id) ===
                              form.warehouseId
                          )?.name ?? form.warehouseId}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-xs font-medium text-[var(--color-sidebar)]">
                          Product
                        </label>
                        <select
                          value={form.productId}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              productId: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-[var(--color-secondary)] bg-[var(--color-neutral)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
                        >
                          <option value="">
                            Choose product
                          </option>
                          {products.map((p) => (
                            <option
                              key={p.stableKey}
                              value={String(p._id ?? p.id)}
                            >
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-[var(--color-sidebar)]">
                          Warehouse
                        </label>
                        <select
                          value={form.warehouseId}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              warehouseId: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-[var(--color-secondary)] bg-[var(--color-neutral)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
                        >
                          <option value="">
                            Choose warehouse
                          </option>
                          {warehouses.map((w) => (
                            <option
                              key={w.stableKey}
                              value={String(w._id ?? w.id)}
                            >
                              {w.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-xs font-medium text-[var(--color-sidebar)]">
                      Boxes
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.boxes}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          boxes: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-[var(--color-secondary)] bg-[var(--color-neutral)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[var(--color-sidebar)]">
                      Loose items
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.looseItems}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          looseItems: Math.max(
                            0,
                            Number(e.target.value)
                          ),
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-[var(--color-secondary)] bg-[var(--color-neutral)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[var(--color-sidebar)]">
                      Low stock (boxes)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.lowStockBoxes}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          lowStockBoxes: Number(
                            e.target.value
                          ),
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-[var(--color-secondary)] bg-[var(--color-neutral)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[var(--color-sidebar)]">
                      Low stock (loose)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.lowStockItems}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          lowStockItems: Number(
                            e.target.value
                          ),
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-[var(--color-secondary)] bg-[var(--color-neutral)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="w-full rounded-lg border border-[var(--color-secondary)] bg-[var(--color-white)] px-4 py-2 text-sm font-medium text-[var(--color-sidebar)] hover:bg-[var(--color-neutral)] transition sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-[var(--color-white)] shadow-md hover:brightness-95 transition sm:w-auto"
                  >
                    {form._id ? "Update stock" : "Add stock"}
                  </button>
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default AdminInventoryManager;

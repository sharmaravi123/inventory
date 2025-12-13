// src/app/warehouse/components/inventory/UserInventoryManager.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import { useDispatch, useSelector } from "react-redux";
import { X } from "lucide-react";
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

type Product = {
  _id?: string | number;
  id?: string | number;
  name?: string;
  stableKey?: string;

  purchasePrice?: number;
  purchase_price?: number;

  sellingPrice?: number;
  sellPrice?: number;

  price?: number;

  perBoxItem?: number;
  taxPercent?: number;
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
  itemsPerBox: number; // local UI state only; real is product.perBoxItem
  looseItems: number;
  lowStockBoxes: number;
  lowStockItems: number;
  tax: number; // local UI field only; real is product.taxPercent
};

type Props = {
  initialItems?: InventoryItem[];
  allowedWarehouseIdsProp?: string[] | undefined;
  assignedWarehouseForUser?: string[] | undefined;
};

const UserInventoryManager: React.FC<Props> = ({
  initialItems,
  allowedWarehouseIdsProp,
  assignedWarehouseForUser,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const reduxItems = useSelector((s: RootState) => s.inventory.items);
  const loading = useSelector((s: RootState) => s.inventory.loading);
  const rawProducts = useSelector((s: RootState) => s.product.products ?? []);
  const rawWarehouses = useSelector((s: RootState) => s.warehouse.list ?? []);

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

  const items = useMemo(
    () =>
      Array.isArray(initialItems) && initialItems.length > 0
        ? initialItems
        : reduxItems ?? [],
    [initialItems, reduxItems]
  );

  const allowedWarehouseIds = useMemo(() => {
    if (Array.isArray(assignedWarehouseForUser)) return assignedWarehouseForUser;
    if (Array.isArray(allowedWarehouseIdsProp)) return allowedWarehouseIdsProp;
    return undefined;
  }, [assignedWarehouseForUser, allowedWarehouseIdsProp]);

  const [search, setSearch] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [stockFilter, setStockFilter] = useState<
    "all" | "stock" | "low stock" | "out of stock"
  >("all");
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState<FormState>({
    productId: "",
    warehouseId:
      Array.isArray(allowedWarehouseIds) && allowedWarehouseIds.length === 1
        ? String(allowedWarehouseIds[0])
        : "",
    boxes: 0,
    itemsPerBox: 1,
    looseItems: 0,
    lowStockBoxes: 0,
    lowStockItems: 0,
    tax: 0,
  });

  useEffect(() => {
    dispatch(fetchProducts());
    dispatch(fetchWarehouses());
    if (!initialItems || initialItems.length === 0) dispatch(fetchInventory());
  }, [dispatch, initialItems]);

  useEffect(() => {
    if (Array.isArray(allowedWarehouseIds) && allowedWarehouseIds.length === 1) {
      setForm((s) => ({ ...s, warehouseId: String(allowedWarehouseIds[0]) }));
    }
  }, [allowedWarehouseIds]);

  const extractId = useCallback((ref: unknown): string | undefined => {
    if (!ref) return undefined;
    if (typeof ref === "string" || typeof ref === "number") return String(ref);
    if (typeof ref === "object") {
      const obj = ref as Record<string, unknown>;
      const val = obj._id ?? obj.id;
      return val ? String(val) : undefined;
    }
    return undefined;
  }, []);

  const getProductName = useCallback(
    (inv: InventoryItem): string => {
      const prodObj = inv.product;
      if (prodObj?.name) return String(prodObj.name);

      const pid = extractId(inv.productId ?? prodObj) ?? "";
      return products.find((x) => String(x._id ?? x.id) === pid)?.name ?? pid;
    },
    [products, extractId]
  );

  const getWarehouseName = useCallback(
    (inv: InventoryItem): string => {
      const whObj = inv.warehouse;
      if (whObj?.name) return String(whObj.name);

      const wid = extractId(inv.warehouseId ?? whObj) ?? "";
      return (
        warehouses.find((x) => String(x._id ?? x.id) === wid)?.name ?? wid
      );
    },
    [warehouses, extractId]
  );

  const getItemsPerBox = useCallback(
    (inv: InventoryItem): number => inv.product?.perBoxItem ?? 1,
    []
  );

  const getTaxPercent = useCallback(
    (inv: InventoryItem): number => inv.product?.taxPercent ?? 0,
    []
  );

  const filteredItems = useMemo(() => {
    return items.filter((inv) => {
      const itemsPerBox = inv.product?.perBoxItem ?? 1;
      const total = inv.boxes * itemsPerBox + inv.looseItems;

      const pname = getProductName(inv).toLowerCase();
      const wname = getWarehouseName(inv).toLowerCase();

      const pid = extractId(inv.productId ?? inv.product) ?? "";
      const wid = extractId(inv.warehouseId ?? inv.warehouse) ?? "";

      if (
        Array.isArray(allowedWarehouseIds) &&
        allowedWarehouseIds.length > 0 &&
        !allowedWarehouseIds.includes(wid)
      )
        return false;

      if (filterProduct && pid !== filterProduct) return false;

      if (search && !(`${pname} ${wname}`).includes(search.toLowerCase()))
        return false;

      const lowTotal =
        (inv.lowStockBoxes ?? 0) * itemsPerBox +
        (inv.lowStockItems ?? 0);

      if (stockFilter === "out of stock") return total === 0;
      if (stockFilter === "low stock") return total > 0 && total <= lowTotal;
      if (stockFilter === "stock") return total > lowTotal;

      return true;
    });
  }, [
    items,
    search,
    filterProduct,
    stockFilter,
    allowedWarehouseIds,
    extractId,
    getProductName,
    getWarehouseName,
  ]);

  const normalizeLooseToBoxes = (
    boxes: number,
    itemsPerBox: number,
    loose: number
  ) => {
    if (itemsPerBox <= 0) itemsPerBox = 1;
    if (loose >= itemsPerBox) {
      const extra = Math.floor(loose / itemsPerBox);
      boxes += extra;
      loose = loose % itemsPerBox;
    }
    return { boxes, looseItems: loose };
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!form._id && (!form.productId || !form.warehouseId)) {
      Swal.fire("Error", "Please select product and warehouse", "error");
      return;
    }

    const itemsPerBox =
      products.find((p) => String(p._id ?? p.id) === form.productId)
        ?.perBoxItem ?? form.itemsPerBox;

    const normalized = normalizeLooseToBoxes(
      form.boxes,
      itemsPerBox,
      form.looseItems
    );

    const taxPercent =
      products.find((p) => String(p._id ?? p.id) === form.productId)
        ?.taxPercent ?? form.tax;

    const payload = {
      productId: form.productId,
      warehouseId: form.warehouseId,
      boxes: normalized.boxes,
      itemsPerBox,
      looseItems: normalized.looseItems,
      lowStockBoxes: form.lowStockBoxes,
      lowStockItems: form.lowStockItems,
      taxPercent,
    };

    try {
      if (form._id) {
        await dispatch(
          updateInventory({ id: form._id, data: payload })
        ).unwrap();
        Swal.fire("Updated", "Stock updated", "success");
      } else {
        await dispatch(addInventory(payload)).unwrap();
        Swal.fire("Added", "Stock added", "success");
      }
      setModalOpen(false);
      dispatch(fetchInventory());
    } catch (err) {
      Swal.fire("Error", "Failed to save", "error");
    }
  };

  const openEdit = (inv: InventoryItem) => {
    setForm({
      _id: inv._id,
      productId: extractId(inv.productId ?? inv.product) ?? "",
      warehouseId: extractId(inv.warehouseId ?? inv.warehouse) ?? "",
      boxes: inv.boxes,
      itemsPerBox: inv.product?.perBoxItem ?? 1,
      looseItems: inv.looseItems,
      lowStockBoxes: inv.lowStockBoxes ?? 0,
      lowStockItems: inv.lowStockItems ?? 0,
      tax: inv.product?.taxPercent ?? 0,
    });
    setModalOpen(true);
  };

  const showWarehouseSelect =
    !Array.isArray(allowedWarehouseIds) ||
    allowedWarehouseIds.length === 0;

  return (
    <div className="min-h-screen p-6 bg-[var(--color-neutral)]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        <header className="flex justify-between">
          <h1 className="text-3xl font-bold">Inventory</h1>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-[var(--color-primary)] text-white px-4 py-2 rounded"
          >
            Add Stock
          </button>
        </header>

        <section className="mt-6 bg-white shadow rounded p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-left">Warehouse</th>
                <th className="p-2 text-center">Boxes</th>
                <th className="p-2 text-center">Items/Box</th>
                <th className="p-2 text-center">Loose</th>
                <th className="p-2 text-center">Tax</th>
                <th className="p-2 text-center">Total</th>
                <th className="p-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((inv) => {
                const itemsPerBox = getItemsPerBox(inv);
                const tax = getTaxPercent(inv);
                const total = inv.boxes * itemsPerBox + inv.looseItems;

                return (
                  <tr key={inv._id} className="border-b">
                    <td className="p-2">{getProductName(inv)}</td>
                    <td className="p-2">{getWarehouseName(inv)}</td>
                    <td className="p-2 text-center">{inv.boxes}</td>
                    <td className="p-2 text-center">{itemsPerBox}</td>
                    <td className="p-2 text-center">{inv.looseItems}</td>
                    <td className="p-2 text-center">{tax}%</td>
                    <td className="p-2 text-center">{total}</td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => openEdit(inv)}
                        className="px-3 py-1 bg-blue-500 text-white rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteInventory(inv._id)}
                        className="px-3 py-1 bg-red-500 text-white rounded ml-2"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </motion.div>
    </div>
  );
};

export default UserInventoryManager;

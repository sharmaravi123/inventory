"use client";

import React, { useEffect, useMemo } from "react";
import {
  Package,
  AlertTriangle,
  Plus,
  FileText,
  IndianRupee,
} from "lucide-react";
import { motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store/store";

import { fetchInventory } from "@/store/inventorySlice";
import { fetchProducts, type ProductType } from "@/store/productSlice";
import { fetchDrivers } from "@/store/driverSlice";
import { useListBillsQuery, type Bill } from "@/store/billingApi";
import { useRouter } from "next/navigation";

// ---------------------------------------------
// TYPES
// ---------------------------------------------

interface WarehouseRef {
  _id?: string;
  id?: string | number;
  name?: string;
}

interface ProductRef {
  _id?: string;
  id?: string | number;
  name?: string;
  perBoxItem?: number;
}

interface InventoryRaw {
  _id: string;
  boxes: number;
  looseItems: number;
  lowStockBoxes?: number | null;
  lowStockItems?: number | null;

  productId?: string;
  product?: ProductRef;

  warehouseId?: string;
  warehouse?: WarehouseRef;
}

interface InventoryWithProduct extends InventoryRaw {
  itemsPerBox: number;
  productName: string;
  warehouseName: string;
}

interface BillLineWarehouseRef {
  warehouseId?: string;
  warehouse?: WarehouseRef;
}

interface BillWithWarehouseLines extends Bill {
  items: (BillLineWarehouseRef & Bill["items"][number])[];
}

// ---------------------------------------------
// HELPERS
// ---------------------------------------------

function extractId(ref: WarehouseRef | ProductRef | string | number | null | undefined): string | undefined {
  if (!ref) return undefined;

  if (typeof ref === "string" || typeof ref === "number") {
    return String(ref);
  }

  if (typeof ref === "object") {
    return ref._id ? String(ref._id) : ref.id ? String(ref.id) : undefined;
  }

  return undefined;
}

function filterBillsForWarehouse(
  bills: BillWithWarehouseLines[],
  warehouseId?: string
): BillWithWarehouseLines[] {
  if (!warehouseId) return [];
  return bills.filter((bill) =>
    bill.items.some((line) => {
      const wid = line.warehouseId ?? extractId(line.warehouse);
      return wid && String(wid) === String(warehouseId);
    })
  );
}

// ---------------------------------------------
// COMPONENT
// ---------------------------------------------

export default function WarehouseDashboardOverview({
  warehouseId,
}: {
  warehouseId?: string;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const { items: inventoryRaw } = useSelector((state: RootState) => state.inventory);
  const { products } = useSelector((state: RootState) => state.product);
  const { items: drivers } = useSelector((state: RootState) => state.driver);

  const { data: billsData } = useListBillsQuery({
    search: "",
    warehouseId,
  });
  const allBills = (billsData?.bills ?? []) as BillWithWarehouseLines[];

  // LOAD DATA
  useEffect(() => {
    dispatch(fetchProducts());
    dispatch(fetchInventory());
    dispatch(fetchDrivers());
  }, [dispatch]);

  // ---------------------------------------------
  // MERGE: Inventory + Product Data
  // ---------------------------------------------

  const inventory: InventoryWithProduct[] = useMemo(() => {
    return inventoryRaw.map((inv: InventoryRaw) => {
      const pid = extractId(inv.product) ?? inv.productId;

      const prod = products.find((p: ProductType) => String(p._id) === String(pid));

      const warehouseName =
        inv.warehouse?.name ??
        (typeof inv.warehouseId === "string" ? inv.warehouseId : "Unknown");

      return {
        ...inv,
        itemsPerBox: prod?.perBoxItem ?? 1,
        productName: prod?.name ?? "Unknown Product",
        warehouseName,
      };
    });
  }, [inventoryRaw, products]);

  // ---------------------------------------------
  // FILTER inventory by warehouse
  // ---------------------------------------------

  const filteredInventory = useMemo(() => {
    if (!warehouseId) return [];

    return inventory.filter((item) => {
      const wid = item.warehouseId ?? extractId(item.warehouse);
      return wid && String(wid) === String(warehouseId);
    });
  }, [inventory, warehouseId]);

  // ---------------------------------------------
  // FILTER bills
  // ---------------------------------------------

  const filteredBills = useMemo(
    () => filterBillsForWarehouse(allBills, warehouseId),
    [allBills, warehouseId]
  );

  // ---------------------------------------------
  // COUNT products
  // ---------------------------------------------

  const totalProducts = useMemo(() => {
    const set = new Set<string>();

    filteredInventory.forEach((item) => {
      const pid = extractId(item.product) ?? (item.productId ? String(item.productId) : undefined);
      if (pid) set.add(pid);
    });

    return set.size;
  }, [filteredInventory]);

  // ---------------------------------------------
  // LOW STOCK counters
  // ---------------------------------------------

  const { lowStock, outOfStock } = useMemo(() => {
    let low = 0;
    let out = 0;

    filteredInventory.forEach((item) => {
      const qtyPerBox = item.itemsPerBox;
      const totalItems = item.boxes * qtyPerBox + item.looseItems;

      const threshold =
        (item.lowStockBoxes ?? 0) * qtyPerBox +
        (item.lowStockItems ?? 0);

      if (totalItems === 0) out++;
      else if (threshold > 0 && totalItems <= threshold) low++;
    });

    return { lowStock: low, outOfStock: out };
  }, [filteredInventory]);

  const totalStockAlerts = lowStock + outOfStock;

  // ---------------------------------------------
  // Orders + Dues
  // ---------------------------------------------

  const { totalOrders, outstandingDues } = useMemo(() => {
    let count = 0;
    let dues = 0;

    filteredBills.forEach((bill) => {
      count++;
      if (bill.balanceAmount > 0) dues += bill.balanceAmount;
    });

    return { totalOrders: count, outstandingDues: dues };
  }, [filteredBills]);

  // ---------------------------------------------
  // UI STATS
  // ---------------------------------------------

  const stats = [
    {
      key: "products",
      title: "Total Products",
      value: totalProducts.toString(),
      icon: <Package size={18} />,
      infoColor: "text-green-600",
    },
    {
      key: "stockAlerts",
      title: "Stock Alerts",
      value: totalStockAlerts.toString(),
      icon: <AlertTriangle size={18} />,
      infoColor: totalStockAlerts > 0 ? "text-red-600" : "text-green-600",
      info: `${lowStock} low • ${outOfStock} out`,
    },
    {
      key: "orders",
      title: "Total Orders",
      value: totalOrders.toString(),
      icon: <FileText size={18} />,
      infoColor: "text-green-600",
    },
    {
      key: "dues",
      title: "Outstanding Dues",
      value: `₹${outstandingDues.toFixed(2)}`,
      icon: <IndianRupee size={18} />,
      infoColor: outstandingDues > 0 ? "text-red-600" : "text-green-600",
    },
  ];

  const quickActions = [
    {
      label: "Add New Product",
      icon: <Plus size={16} />,
      link: "/warehouse/product",
    },
    {
      label: "Create New Order",
      icon: <FileText size={16} />,
      link: "/admin/billing",
    },
    {
      label: "View All Reports",
      icon: <FileText size={16} />,
      link: "/warehouse/reports",
    },
  ];

  // ---------------------------------------------
  // RENDER
  // ---------------------------------------------

  return (
    <div className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-12">
      {/* Stats */}
      <div className="lg:col-span-8 xl:col-span-9 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((item) => (
          <motion.div
            key={item.key}
            whileHover={{ y: -4, scale: 1.02 }}
            className="rounded-xl border p-4 shadow-sm"
          >
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-sm text-gray-600">
                {item.icon}
                {item.title}
              </span>
            </div>

            <h3 className="mt-2 text-2xl font-bold">{item.value}</h3>

            <p className={`mt-1 text-xs ${item.infoColor}`}>{item.info ?? ""}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15 }}
        className="lg:col-span-4 xl:col-span-3 rounded-xl border p-4 bg-gray-50"
      >
        <h3 className="font-semibold mb-1">Quick Actions</h3>
        <p className="text-xs text-gray-500 mb-4">Warehouse shortcuts.</p>

        <div className="flex flex-col space-y-2">
          {quickActions.map((action) => (
            <motion.button
              key={action.label}
              whileHover={{ scale: 1.04 }}
              onClick={() => router.push(action.link)}
              className="flex items-center gap-2 border rounded-lg p-2 bg-white text-sm hover:text-blue-600"
            >
              {action.icon}
              {action.label}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

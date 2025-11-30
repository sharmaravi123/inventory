// app/warehouse/components/Dashboard/WarehouseDashboardOverview.tsx
"use client";

import React, { useEffect, useMemo } from "react";
import { Package, AlertTriangle, Plus, FileText, IndianRupee } from "lucide-react";
import { motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store/store";
import { fetchInventory } from "@/store/inventorySlice";
import { fetchProducts } from "@/store/productSlice";
import { fetchDrivers } from "@/store/driverSlice";
import { useListBillsQuery, type Bill } from "@/store/billingApi";
import { useRouter } from "next/navigation";

type WarehouseDashboardOverviewProps = {
  warehouseId?: string;
};

interface InventoryItemForDashboard {
  boxes: number;
  itemsPerBox: number;
  looseItems: number;
  lowStockBoxes?: number | null;
  lowStockItems?: number | null;
  warehouseId?: string;
  warehouse?: {
    _id?: string;
    id?: string;
    name?: string;
  };
  productId?: string;
  product?: {
    _id?: string;
  };
}

interface InventorySliceState {
  items: InventoryItemForDashboard[];
}

interface ProductSliceState {
  products: unknown[];
}

interface DriverItem {
  _id?: string;
  name?: string;
}

interface DriverSliceState {
  items: DriverItem[];
}

interface BillLineWarehouseRef {
  warehouseId?: string;
  warehouse?: unknown;
}

interface BillWithWarehouseLines extends Bill {
  items: (BillLineWarehouseRef & Bill["items"][number])[];
}

function extractId(ref: unknown): string | undefined {
  if (ref == null) return undefined;
  if (typeof ref === "string" || typeof ref === "number") return String(ref);
  if (typeof ref === "object") {
    const obj = ref as Record<string, unknown>;
    const candidate = obj._id ?? obj.id;
    if (candidate == null || candidate === "") return undefined;
    return String(candidate);
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
      if (!wid) return false;
      return String(wid) === String(warehouseId);
    })
  );
}

export default function WarehouseDashboardOverview({
  warehouseId,
}: WarehouseDashboardOverviewProps) {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const { products } = useSelector((state: RootState) => {
    const productState = state.product as ProductSliceState;
    return {
      products: productState.products,
    };
  });

  const { items: allInventory } = useSelector((state: RootState) => {
    const slice = state.inventory as InventorySliceState;
    return {
      items: slice.items,
    };
  });

  const { items: drivers } = useSelector((state: RootState) => {
    const slice = state.driver as DriverSliceState;
    return {
      items: slice.items,
    };
  });

  // 👇 yaha warehouseId pass kar rahe hain
  const { data: billsData } = useListBillsQuery({
    search: "",
    warehouseId,
  });
  const allBills = (billsData?.bills ?? []) as BillWithWarehouseLines[];

  useEffect(() => {
    dispatch(fetchProducts());
    dispatch(fetchInventory());
    dispatch(fetchDrivers());
  }, [dispatch]);

  const filteredInventory = useMemo(() => {
    if (!warehouseId) return [];
    return allInventory.filter((item) => {
      const wid = item.warehouseId ?? extractId(item.warehouse);
      if (!wid) return false;
      return String(wid) === String(warehouseId);
    });
  }, [allInventory, warehouseId]);

  const filteredBills = useMemo(
    () => filterBillsForWarehouse(allBills, warehouseId),
    [allBills, warehouseId]
  );

  const totalProducts = useMemo(() => {
    if (!warehouseId) return 0;

    const set = new Set<string>();
    filteredInventory.forEach((item) => {
      const idFromProduct = item.product?._id;
      const idFromField = item.productId;
      const id = idFromProduct ?? idFromField;
      if (id) {
        set.add(id);
      }
    });

    return set.size;
  }, [filteredInventory, warehouseId]);

  const { lowStock, outOfStock } = useMemo(() => {
    if (!filteredInventory.length) return { lowStock: 0, outOfStock: 0 };

    let low = 0;
    let out = 0;

    filteredInventory.forEach((item) => {
      const totalItems = item.boxes * item.itemsPerBox + item.looseItems;
      const lowStockTotal =
        (item.lowStockBoxes ?? 0) * item.itemsPerBox +
        (item.lowStockItems ?? 0);

      if (totalItems === 0) out += 1;
      else if (totalItems > 0 && totalItems <= lowStockTotal) low += 1;
    });

    return { lowStock: low, outOfStock: out };
  }, [filteredInventory]);

  const totalStockAlerts = lowStock + outOfStock;

  const { totalOrders, outstandingDues } = useMemo(() => {
    let ordersCount = 0;
    let dues = 0;

    filteredBills.forEach((bill) => {
      ordersCount += 1;
      if (bill.balanceAmount > 0) {
        dues += bill.balanceAmount;
      }
    });

    return {
      totalOrders: ordersCount,
      outstandingDues: dues,
    };
  }, [filteredBills]);

  const stats = [
    {
      key: "products",
      title: "Total Products",
      value: totalProducts.toString(),
      icon: <Package size={18} />,
      infoColor: "text-green-600",
      info: "",
    },
    {
      key: "stockAlerts",
      title: "Stock Alerts",
      value: totalStockAlerts.toString(),
      icon: <AlertTriangle size={18} />,
      info: `${lowStock} low • ${outOfStock} out`,
      infoColor: totalStockAlerts > 0 ? "text-red-600" : "text-green-600",
    },
    {
      key: "orders",
      title: "Total Orders",
      value: totalOrders.toString(),
      icon: <FileText size={18} />,
      infoColor: "text-green-600",
      info: "",
    },
    {
      key: "dues",
      title: "Outstanding Dues",
      value: `₹${outstandingDues.toFixed(2)}`,
      icon: <IndianRupee size={18} />,
      infoColor: outstandingDues > 0 ? "text-red-600" : "text-green-600",
      info: "",
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-9 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 h-15">
        {stats.map((item) => (
          <motion.div
            key={item.key}
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="rounded-xl border border-[var(--border-color)] bg-[var(--color-white)] p-4 shadow-sm hover:shadow-md"
          >
            <div className="flex items-center justify-between ">
              <span className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
                {item.icon}
                {item.title}
              </span>
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">
                {item.value}
              </h3>
              <p className={`mt-1 text-xs ${item.infoColor}`}>
                {item.info ?? ""}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="lg:col-span-3 rounded-xl border border-[var(--border-color)] bg-[var(--color-neutral)] p-5"
      >
        <h3 className="mb-1 font-semibold text-[var(--text-primary)]">
          Quick Actions
        </h3>
        <p className="mb-4 text-xs text-[var(--text-secondary)]">
          Perform essential tasks for this warehouse.
        </p>
        <div className="flex flex-col space-y-2 ">
          {quickActions.map((action) => (
            <motion.button
              key={action.label}
              whileHover={{ scale: 1.03 }}
              transition={{ duration: 0.2 }}
              onClick={() => router.push(action.link)}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--color-white)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--color-primary)] hover:shadow-sm transition-colors"
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

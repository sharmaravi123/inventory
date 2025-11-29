// app/warehouse/page.tsx
"use client";

import { motion } from "framer-motion";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import WarehouseDashboardOverview from "./components/Dashboard/WarehouseDashboardOverview";
import WarehouseSalesOverviewChart from "./components/Dashboard/WarehouseSalesOverviewChart";
import WarehouseTopProductsBySales from "./components/Dashboard/WarehouseTopProductsBySales";
import WarehouseInventoryDistribution from "./components/Dashboard/WarehouseInventoryDistribution";
import WarehouseRecentOrders from "./components/Dashboard/WarehouseRecentOrders";

interface WarehouseItem {
  _id: string;
  name: string;
}

interface WarehouseSliceState {
  list: WarehouseItem[];
  selectedWarehouseId?: string;
  currentWarehouseId?: string;
}

export default function WarehousePage() {
  const warehouseState = useSelector((state: RootState) => {
    const slice = state.warehouse as WarehouseSliceState;
    return slice;
  });

  const activeWarehouseId =
    warehouseState.selectedWarehouseId ??
    warehouseState.currentWarehouseId ??
    (warehouseState.list[0]?._id ?? undefined);

  const activeWarehouse =
    warehouseState.list.find((w) => w._id === activeWarehouseId) ??
    warehouseState.list[0];

  const activeWarehouseName = activeWarehouse?.name ?? "All Warehouses";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-6"
    >
      <h1 className="text-2xl font-bold text-[var(--color-sidebar)] py-2 px-3 md:px-8 flex items-center gap-2 flex-wrap">
        Warehouse Dashboard
        <span className="text-sm font-medium text-[var(--text-secondary)] bg-[var(--color-neutral)] px-3 py-1 rounded-full">
          {activeWarehouseName}
        </span>
      </h1>

      <div className="p-6">
        <WarehouseDashboardOverview warehouseId={activeWarehouseId} />
      </div>

      <h1 className="text-2xl font-bold text-[var(--color-sidebar)] py-2 px-3 md:px-8">
        Analytics Overview
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-6">
          <WarehouseSalesOverviewChart warehouseId={activeWarehouseId} />
        </div>
        <WarehouseTopProductsBySales warehouseId={activeWarehouseId} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <WarehouseInventoryDistribution warehouseId={activeWarehouseId} />
        <WarehouseRecentOrders warehouseId={activeWarehouseId} />
      </div>
    </motion.div>
  );
}

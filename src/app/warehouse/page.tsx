// app/warehouse/page.tsx
"use client";

import { useEffect, useState } from "react";
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

// same types as Topbar
type WarehouseMe = { _id: string; name?: string };
type UserMe = {
  _id: string;
  name: string;
  email: string;
  role?: string;
  warehouses?: WarehouseMe[];
};

export default function WarehousePage() {
  const warehouseState = useSelector((state: RootState) => {
    const slice = state.warehouse as WarehouseSliceState;
    return slice;
  });

  const [me, setMe] = useState<UserMe | null>(null);
  const [meLoading, setMeLoading] = useState(false);
  const [meError, setMeError] = useState<string | null>(null);

  useEffect(() => {
    const loadMe = async (): Promise<void> => {
      try {
        setMeLoading(true);
        setMeError(null);

        const res = await fetch("/api/user/me", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setMeError(body?.error ?? `Failed (${res.status})`);
          return;
        }

        const body = await res.json();
        const u: UserMe = body?.user ?? body;
        setMe(u);
      } catch {
        setMeError("Failed to load user info");
      } finally {
        setMeLoading(false);
      }
    };

    void loadMe();
  }, []);

  const userWarehouseId =
    me?.warehouses && me.warehouses.length > 0
      ? me.warehouses[0]._id
      : undefined;

  // pehle slice se nikalo (agar admin side se selection hai)
  const sliceWarehouseId =
    warehouseState.selectedWarehouseId ??
    warehouseState.currentWarehouseId ??
    (warehouseState.list[0]?._id ?? undefined);

  // final: logged-in user ke warehouse ko priority do
  const activeWarehouseId = userWarehouseId ?? sliceWarehouseId;

  const activeWarehouse =
    warehouseState.list.find((w) => w._id === activeWarehouseId) ??
    warehouseState.list[0];

  const activeWarehouseName = activeWarehouse?.name ?? "All Warehouses";

  // agar warehouses list hi empty hai
  if (!warehouseState.list || warehouseState.list.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-red-600">
          No warehouses found for this account.
        </h1>
      </div>
    );
  }

  // optional: thoda loading state jab tak me aa raha hai
  const headingSuffix =
    meLoading && !me ? "Loading warehouse..." : `(${activeWarehouseName})`;

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
          {headingSuffix}
        </span>
      </h1>

      {meError && (
        <p className="px-6 text-sm text-red-500">
          {meError}
        </p>
      )}

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

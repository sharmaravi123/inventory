// app/warehouse/page.tsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "@/store/store";
import { fetchWarehouses } from "@/store/warehouseSlice";
import WarehouseDashboardOverview from "./components/Dashboard/WarehouseDashboardOverview";
import WarehouseSalesOverviewChart from "./components/Dashboard/WarehouseSalesOverviewChart";
import WarehouseTopProductsBySales from "./components/Dashboard/WarehouseTopProductsBySales";
import WarehouseRecentOrders from "./components/Dashboard/WarehouseRecentOrders";
import WarehouseInventoryDistribution from "./components/Dashboard/WarehouseInventoryDistribution";

interface WarehouseItem {
  _id: string;
  name: string;
}

interface WarehouseSliceState {
  list: WarehouseItem[];
  selectedWarehouseId?: string;
  currentWarehouseId?: string;
  loading?: boolean;
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
  const dispatch = useDispatch<AppDispatch>();

  const warehouseState = useSelector((state: RootState) => {
    const slice = state.warehouse as WarehouseSliceState;
    return slice;
  });

  const [me, setMe] = useState<UserMe | null>(null);
  const [meLoading, setMeLoading] = useState(false);
  const [meError, setMeError] = useState<string | null>(null);

  // user info load
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

  // warehouses load (agar list empty hai)
  useEffect(() => {
    if (!warehouseState.list || warehouseState.list.length === 0) {
      dispatch(fetchWarehouses());
    }
  }, [dispatch, warehouseState.list]);

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

  const warehousesLoading = warehouseState.loading ?? false;
  const hasWarehouses =
    Array.isArray(warehouseState.list) && warehouseState.list.length > 0;

  // loading state
  if ((meLoading && !me) || (warehousesLoading && !hasWarehouses)) {
    return (
      <div className="p-4 sm:p-6">
        <h1 className="text-lg sm:text-xl font-semibold text-[var(--color-sidebar)]">
          Loading warehouse dashboard...
        </h1>
      </div>
    );
  }

  // actually koi warehouse assign hi nahi hai
  if (!warehousesLoading && !hasWarehouses) {
    return (
      <div className="p-4 sm:p-6">
        <h1 className="text-lg sm:text-xl font-semibold text-red-600">
          No warehouses found for this account.
        </h1>
      </div>
    );
  }

  const headingSuffix =
    meLoading && !me ? "Loading warehouse..." : `(${activeWarehouseName})`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-4 sm:space-y-6 pb-4 sm:pb-6"
    >
      <div className="px-3 sm:px-6 md:px-8">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-sidebar)] flex items-center gap-2 flex-wrap">
          Warehouse Dashboard
          <span className="text-xs sm:text-sm font-medium text-[var(--text-secondary)] bg-[var(--color-neutral)] px-3 py-1 rounded-full">
            {headingSuffix}
          </span>
        </h1>
        {meError && (
          <p className="mt-1 text-xs sm:text-sm text-red-500">
            {meError}
          </p>
        )}
      </div>

      {/* Stats + quick actions */}
      <section className="px-3 sm:px-6 md:px-8">
        <div className="rounded-2xl bg-[var(--color-neutral)]/60 p-3 sm:p-4">
          <WarehouseDashboardOverview warehouseId={activeWarehouseId} />
        </div>
      </section>

      {/* Charts row */}
      <section className="px-3 sm:px-6 md:px-8 space-y-3 sm:space-y-4">
        <h2 className="text-lg sm:text-2xl font-bold text-[var(--color-sidebar)]">
          Analytics Overview
        </h2>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-4 sm:p-6 w-full">
            <WarehouseSalesOverviewChart warehouseId={activeWarehouseId} />
          </div>
          <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-4 sm:p-6 w-full">
            <WarehouseTopProductsBySales warehouseId={activeWarehouseId} />
          </div>
        </div>
      </section>

      {/* Inventory + recent orders */}
      <section className="px-3 sm:px-6 md:px-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-4 sm:p-6 w-full">
            <WarehouseInventoryDistribution warehouseId={activeWarehouseId} />
          </div>
          <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-4 sm:p-6 w-full">
            <WarehouseRecentOrders warehouseId={activeWarehouseId} />
          </div>
        </div>
      </section>
    </motion.div>
  );
}

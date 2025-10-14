"use client";

import DashboardOverview from "./components/Dashboard/DashboardOverview";
import { motion } from "framer-motion";
import SalesOverviewChart from "./components/Dashboard/SalesOverviewChart";
import InventoryDistribution from "./components/Dashboard/InventoryDistribution";
import LowStockAlerts from "./components/Dashboard/LowStockAlerts";
import RecentOrders from "./components/Dashboard/RecentOrders";
import TopProductsBySales from "./components/Dashboard/TopProductsBySales";

export default function AdminPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-6"
    >
      <h1 className="text-2xl font-bold text-[var(--color-sidebar)] py-2 px-3 md:px-8">
        Admin Dashboard
      </h1>

      <div className="p-6">
        <DashboardOverview />
      </div>
       <h1 className="text-2xl font-bold text-[var(--color-sidebar)] py-2 px-3 md:px-8">
        Analytics Overview
      </h1>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-6">
          <SalesOverviewChart />
        </div>
        <TopProductsBySales />

      </div>

      {/* Row 2 — Low Stock + Recent Orders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InventoryDistribution />

      </div>

      {/* Row 3 — Top Products by Sales */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <RecentOrders />
        <LowStockAlerts />

      </div>
    </motion.div>
  );
}

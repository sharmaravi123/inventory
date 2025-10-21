"use client";

import React, { useEffect, useMemo } from "react";
import {
  Package,
  Warehouse,
  Truck,
  ShoppingCart,
  AlertTriangle,
  Plus,
  FileText,
  Building2,
  IndianRupee,
} from "lucide-react";
import { motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store/store";
import { fetchWarehouses } from "@/store/warehouseSlice";
import { fetchInventory } from "@/store/inventorySlice";
import { fetchProducts } from "@/store/productSlice";

export default function DashboardOverview() {
  const dispatch = useDispatch<AppDispatch>();

  const { products } = useSelector((state: RootState) => state.product);
  const { list: warehouses } = useSelector((state: RootState) => state.warehouse);
  const { items: inventory } = useSelector((state: RootState) => state.inventory);

  useEffect(() => {
    dispatch(fetchProducts());
    dispatch(fetchWarehouses());
    dispatch(fetchInventory());
  }, [dispatch]);

  const totalProducts = products?.length || 0;
  const totalWarehouses = warehouses?.length || 0;

  // 🧮 Correct low-stock + out-of-stock calculation
  const { lowStock, outOfStock } = useMemo(() => {
    if (!inventory?.length) return { lowStock: 0, outOfStock: 0 };

    let low = 0;
    let out = 0;

    for (const item of inventory) {
      const totalItems = item.boxes * item.itemsPerBox + item.looseItems;
      const lowStockTotal =
        (item.lowStockBoxes ?? 0) * item.itemsPerBox + (item.lowStockItems ?? 0);

      if (totalItems === 0) out++;
      else if (totalItems > 0 && totalItems <= lowStockTotal) low++;
    }

    return { lowStock: low, outOfStock: out };
  }, [inventory]);

  const totalStockAlerts = lowStock + outOfStock;

  const stats = [
    {
      title: "Total Products",
      value: totalProducts.toString(),
      icon: <Package size={18} />,
      info: "+5% last month",
      infoColor: "text-green-600",
    },
    {
      title: "Warehouses",
      value: totalWarehouses.toString(),
      icon: <Warehouse size={18} />,
      info: "New location added",
      infoColor: "text-gray-500",
    },
    {
      title: "Stock Alerts",
      value: totalStockAlerts.toString(),
      icon: <AlertTriangle size={18} />,
      info: `${lowStock} low • ${outOfStock} out`,
      infoColor: totalStockAlerts > 0 ? "text-red-600" : "text-green-600",
    },
    {
      title: "Vehicles",
      value: "38",
      icon: <Truck size={18} />,
      info: "+2 vehicles",
      infoColor: "text-green-600",
    },
    {
      title: "Total Orders",
      value: "5,678",
      icon: <ShoppingCart size={18} />,
      info: "+12% this week",
      infoColor: "text-green-600",
    },
    {
      title: "Outstanding Dues",
      value: "15,200",
      icon: <IndianRupee size={18} />,
      info: "+8% this month",
      infoColor: "text-red-600",
    },
  ];

  const quickActions = [
    { label: "Add New Product", icon: <Plus size={16} /> },
    { label: "Create New Order", icon: <FileText size={16} /> },
    { label: "Add New Warehouse", icon: <Building2 size={16} /> },
    { label: "View All Reports", icon: <FileText size={16} /> },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Stats */}
      <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {stats.map((item, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="rounded-xl border border-[var(--border-color)] bg-[var(--color-white)] p-4 shadow-sm hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)] text-sm font-medium flex items-center gap-2">
                {item.icon}
                {item.title}
              </span>
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">
                {item.value}
              </h3>
              <p className={`text-xs mt-1 ${item.infoColor}`}>{item.info}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="lg:col-span-3 bg-[var(--color-neutral)] rounded-xl p-5 border border-[var(--border-color)]"
      >
        <h3 className="font-semibold text-[var(--text-primary)] mb-1">
          Quick Actions
        </h3>
        <p className="text-xs text-[var(--text-secondary)] mb-4">
          Perform essential tasks instantly.
        </p>
        <div className="flex flex-col space-y-2">
          {quickActions.map((action, i) => (
            <motion.button
              key={i}
              whileHover={{ scale: 1.03 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--color-primary)] transition-colors bg-[var(--color-white)] border border-[var(--border-color)] rounded-lg px-3 py-2 hover:shadow-sm"
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

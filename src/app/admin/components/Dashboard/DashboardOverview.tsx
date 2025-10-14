"use client";

import React from "react";
import {
  Package,
  Warehouse,
  Truck,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  Plus,
  FileText,
  Building2,
} from "lucide-react";
import { motion } from "framer-motion";

const DashboardOverview: React.FC = () => {
  const stats = [
    { title: "Total Products", value: "1,245", icon: <Package size={18} />, info: "+5% last month", infoColor: "text-green-600" },
    { title: "Warehouses", value: "12", icon: <Warehouse size={18} />, info: "New location added", infoColor: "text-gray-500" },
    { title: "Vehicles", value: "38", icon: <Truck size={18} />, info: "+2 vehicles", infoColor: "text-green-600" },
    { title: "Total Orders", value: "5,678", icon: <ShoppingCart size={18} />, info: "+12% this week", infoColor: "text-green-600" },
    { title: "Outstanding Dues", value: "$15,200", icon: <DollarSign size={18} />, info: "+8% this month", infoColor: "text-red-600" },
    { title: "Stock Alerts", value: "23", icon: <AlertTriangle size={18} />, info: "+3 critical items", infoColor: "text-red-600" },
  ];

  const quickActions = [
    { label: "Add New Product", icon: <Plus size={16} /> },
    { label: "Create New Order", icon: <FileText size={16} /> },
    { label: "Add New Warehouse", icon: <Building2 size={16} /> },
    { label: "View All Reports", icon: <FileText size={16} /> },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Stat Cards */}
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
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">{item.value}</h3>
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
};

export default DashboardOverview;

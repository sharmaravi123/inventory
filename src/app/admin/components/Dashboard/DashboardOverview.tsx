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
import { fetchDrivers } from "@/store/driverSlice";
import { useListBillsQuery } from "@/store/billingApi";
import { useRouter } from "next/navigation";

export default function DashboardOverview() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const { products } = useSelector((state: RootState) => state.product);
  const { list: warehouses } = useSelector(
    (state: RootState) => state.warehouse
  );
  const { items: inventory } = useSelector(
    (state: RootState) => state.inventory
  );
  const { items: drivers } = useSelector((state: RootState) => state.driver);

  // billing / orders
  const { data: billsData } = useListBillsQuery({ search: "" });
  const bills = billsData?.bills ?? [];

  useEffect(() => {
    dispatch(fetchProducts());
    dispatch(fetchWarehouses());
    dispatch(fetchInventory());
    dispatch(fetchDrivers());
  }, [dispatch]);

  const totalProducts = products?.length ?? 0;
  const totalWarehouses = warehouses?.length ?? 0;
  const totalDrivers = drivers?.length ?? 0;

  const { lowStock, outOfStock } = useMemo(() => {
  if (!inventory?.length) return { lowStock: 0, outOfStock: 0 };

  let low = 0;
  let out = 0;

  const getItemsPerBox = (productId: string) => {
    const p = products.find((prod) => String(prod._id ?? prod.id) === productId);
    return p?.perBoxItem ?? p?.perBoxItem ?? 1;
  };

  for (const item of inventory) {
    const qtyPerBox = getItemsPerBox(item.productId ?? "");

    const totalItems = item.boxes * qtyPerBox + item.looseItems;

    const lowStockTotal =
      (item.lowStockBoxes ?? 0) * qtyPerBox +
      (item.lowStockItems ?? 0);

    if (totalItems === 0) out += 1;
    else if (totalItems > 0 && totalItems <= lowStockTotal) low += 1;
  }

  return { lowStock: low, outOfStock: out };
}, [inventory, products]);


  const totalStockAlerts = lowStock + outOfStock;

  // orders + dues (from loaded bills)
  const { totalOrders, outstandingDues } = useMemo(() => {
    let ordersCount = 0;
    let dues = 0;

    for (const bill of bills) {
      ordersCount += 1;
      if (bill.balanceAmount > 0) {
        dues += bill.balanceAmount;
      }
    }

    return {
      totalOrders: ordersCount,
      outstandingDues: dues,
    };
  }, [bills]);

  const stats = [
    {
      title: "Total Products",
      value: totalProducts.toString(),
      icon: <Package size={18} />,
      infoColor: "text-green-600",
    },
    {
      title: "Warehouses",
      value: totalWarehouses.toString(),
      icon: <Warehouse size={18} />,
      infoColor: "text-gray-500",
    },
    {
      title: "Drivers",
      value: totalDrivers.toString(),
      icon: <Truck size={18} />,
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
      title: "Total Orders",
      value: totalOrders.toString(),
      icon: <ShoppingCart size={18} />,
      infoColor: "text-green-600",
    },
    {
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
      link: "/admin/product",
    },
    {
      label: "Create New Order",
      icon: <FileText size={16} />,
      link: "/admin/billing",
    },
    {
      label: "Add New Warehouse",
      icon: <Building2 size={16} />,
      link: "/admin/warehouse",
    },
    {
      label: "View All Reports",
      icon: <FileText size={16} />,
      link: "/admin/reports",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Stats */}
      <div className="lg:col-span-9 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((item, i) => (
          <motion.div
            key={item.title}
            whileHover={{ y: -5, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="rounded-xl border border-[var(--border-color)] bg-[var(--color-white)] p-4 shadow-sm hover:shadow-md"
          >
            <div className="flex items-center justify-between">
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

      {/* Quick Actions */}
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
          Perform essential tasks instantly.
        </p>
        <div className="flex flex-col space-y-2">
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

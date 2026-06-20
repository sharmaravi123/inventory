"use client";

import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store/store";
import { fetchProducts } from "@/store/productSlice";
import { fetchInventory } from "@/store/inventorySlice";
import { fetchWarehouses } from "@/store/warehouseSlice";
import { fetchDrivers } from "@/store/driverSlice";
import { fetchCompanyProfile } from "@/store/companyProfileSlice";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(fetchProducts());
    dispatch(fetchWarehouses());
    dispatch(fetchInventory());
    dispatch(fetchDrivers());
    dispatch(fetchCompanyProfile());
  }, [dispatch]);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[var(--color-neutral)]">
      <div className="print-hide">
        <Topbar />
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="print-hide">
          <Sidebar />
        </div>
        <main className="flex-1 min-h-0 overflow-y-auto bg-[var(--color-neutral)] p-6 lg:ml-64">
          {children}
        </main>
      </div>
    </div>
  );
}

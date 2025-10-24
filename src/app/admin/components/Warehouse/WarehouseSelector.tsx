"use client";

import React from "react";
import { Warehouse } from "@/store/warehouseSlice";
import { motion } from "framer-motion";

interface Props {
  warehouses: Warehouse[];
  activeWarehouse: string;
  setActiveWarehouse: (id: string) => void;
}

export const WarehouseSelector: React.FC<Props> = ({
  warehouses,
  activeWarehouse,
  setActiveWarehouse,
}) => {
  return (
    <div className="flex flex-wrap gap-3">
      {warehouses.map((w) => (
        <motion.button
          key={w.id}
          onClick={() => setActiveWarehouse(String(w.id))}
          className={`px-4 py-2 rounded-lg border transition-all ${
            activeWarehouse === String(w.id)
              ? "bg-[var(--color-primary)] text-white border-black"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
          }`}
          whileTap={{ scale: 0.95 }}
        >
          {w.name}
        </motion.button>
      ))}
    </div>
  );
};

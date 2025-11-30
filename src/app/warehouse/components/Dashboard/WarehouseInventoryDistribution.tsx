// app/warehouse/components/Dashboard/WarehouseInventoryDistribution.tsx
"use client";

import React, { useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/store/store";
import { fetchProducts, type ProductType } from "@/store/productSlice";
import { fetchInventory } from "@/store/inventorySlice";

const COLORS = [
  "var(--color-primary)",
  "var(--color-success)",
  "var(--color-error)",
  "var(--color-warning)",
  "var(--color-secondary)",
];

type ChartItem = {
  name: string;
  value: number;
};

type WarehouseInventoryDistributionProps = {
  warehouseId?: string;
};

interface ProductSliceState {
  products: ProductType[];
  loading: boolean;
  error: string | null;
}

interface InventoryItem {
  productId?: string;
  product?: ProductType & { _id?: string };
  warehouseId?: string;
  warehouse?: {
    _id?: string;
    id?: string;
    name?: string;
  };
}

interface InventorySliceState {
  items: InventoryItem[];
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

function getCategoryLabel(product: ProductType): string {
  if (product.category && product.category.name) {
    return product.category.name;
  }
  if (product.categoryId) {
    return product.categoryId;
  }
  return "Uncategorized";
}

export default function WarehouseInventoryDistribution({
  warehouseId,
}: WarehouseInventoryDistributionProps) {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    void dispatch(fetchProducts());
    void dispatch(fetchInventory());
  }, [dispatch]);

  const { products, loading } = useSelector((state: RootState) => {
    const productState = state.product as ProductSliceState;
    return {
      products: productState.products,
      loading: productState.loading,
    };
  });

  const { items: allInventory } = useSelector((state: RootState) => {
    const inventoryState = state.inventory as InventorySliceState;
    return {
      items: inventoryState.items,
    };
  });

  const relevantInventory = useMemo(() => {
    if (!warehouseId) return [];
    return allInventory.filter((item) => {
      const wid =
        item.warehouseId ??
        extractId(item.warehouse);
      if (!wid) return false;
      return String(wid) === String(warehouseId);
    });
  }, [warehouseId, allInventory]);

  const relevantProducts = useMemo(() => {
    const productIds = new Set<string>();

    relevantInventory.forEach((item) => {
      const idFromProduct = item.product?._id;
      const idFromField = item.productId;
      const id = idFromProduct ?? idFromField;
      if (id) {
        productIds.add(id);
      }
    });

    return products.filter((p) => {
      const pWithId = p as ProductType & { _id?: string };
      const id = pWithId._id;
      if (!id) return false;
      return productIds.has(id);
    });
  }, [relevantInventory, products]);

  const chartData: ChartItem[] = useMemo(() => {
    if (!relevantProducts || relevantProducts.length === 0) return [];

    const map = new Map<string, number>();

    relevantProducts.forEach((product) => {
      const label = getCategoryLabel(product);
      const prev = map.get(label) ?? 0;
      map.set(label, prev + 1);
    });

    const arr: ChartItem[] = Array.from(map.entries()).map(
      ([name, value]) => ({ name, value })
    );

    arr.sort((a, b) => b.value - a.value);

    return arr;
  }, [relevantProducts]);

  const hasData = chartData.length > 0;

  return (
    <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-6 w-full max-w-md">
      <h2 className="text-xl font-semibold text-gray-900">
        Inventory Distribution – This Warehouse
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Breakdown of products by category for this warehouse.
      </p>

      <div className="w-full h-64 flex items-center justify-center">
        {loading ? (
          <div className="text-gray-400 text-sm">Loading products...</div>
        ) : !hasData ? (
          <div className="text-gray-400 text-sm">
            No products found for this warehouse
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={4}
              >
                {chartData.map((item, i) => (
                  <Cell key={item.name} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="text-xs text-gray-400 mt-4 text-center">
        Made with 💙 Akash Namkeen – Warehouse
      </div>
    </div>
  );
}

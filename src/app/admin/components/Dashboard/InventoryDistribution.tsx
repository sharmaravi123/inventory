"use client";

import React, { useEffect, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/store/store";
import {
  fetchProducts,
  type ProductType,
} from "@/store/productSlice";

const COLORS = [
  "var(--color-primary)",
  "var(--color-success)",
  "var(--color-error)",
  "var(--color-warning)",
  "var(--color-secondary)",
];

type ChartItem = {
  name: string;
  value: number; // number of products in this category
};

interface ProductSliceState {
  products: ProductType[];
  loading: boolean;
  error: string | null;
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

export default function InventoryDistribution() {
  const dispatch = useDispatch<AppDispatch>();

  // load products when widget mounts
  useEffect(() => {
    void dispatch(fetchProducts());
  }, [dispatch]);

  const { products, loading } = useSelector((state: RootState) => {
    const productState = state.product as ProductSliceState;
    return {
      products: productState.products,
      loading: productState.loading,
    };
  });

  const chartData: ChartItem[] = useMemo(() => {
    if (!products || products.length === 0) return [];

    const map = new Map<string, number>();

    products.forEach((product) => {
      const label = getCategoryLabel(product);
      const prev = map.get(label) ?? 0;
      map.set(label, prev + 1); // 1 product = 1 unit for this category
    });

    const arr: ChartItem[] = Array.from(map.entries()).map(
      ([name, value]) => ({ name, value })
    );

    // Optional: sort biggest category first
    arr.sort((a, b) => b.value - a.value);

    return arr;
  }, [products]);

  const hasData = chartData.length > 0;

  return (
    <div className="bg-[var(--color-white)] rounded-2xl shadow-md p-6 w-full max-w-md">
      <h2 className="text-xl font-semibold text-gray-900">
        Inventory Distribution
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Breakdown of products by category (more products ⇒ bigger slice).
      </p>

      <div className="w-full h-64 flex items-center justify-center">
        {loading ? (
          <div className="text-gray-400 text-sm">Loading products...</div>
        ) : !hasData ? (
          <div className="text-gray-400 text-sm">No products found</div>
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
                {chartData.map((_, i) => (
                  <Cell
                    key={chartData[i]?.name ?? i}
                    fill={COLORS[i % COLORS.length]}
                  />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="text-xs text-gray-400 mt-4 text-center">
        Made with 💙 Akash Namkeen
      </div>
    </div>
  );
}

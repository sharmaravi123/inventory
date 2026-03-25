"use client";

import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

interface Props {
  search: string;
  setSearch: (val: string) => void;
  categoryId: string;
  setCategoryId: React.Dispatch<React.SetStateAction<string>>;
  sortOrder: "asc" | "desc";
  setSortOrder: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
}

export default function SearchAndFilters({
  search,
  setSearch,
  categoryId,
  setCategoryId,
  sortOrder,
  setSortOrder,
}: Props) {
  const { categories } = useSelector((state: RootState) => state.category);

  return (
    <div className="mb-3 flex flex-col items-stretch gap-3 md:flex-row md:items-center">
      <input
        placeholder="Search by name or SKU..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-white)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70 md:w-1/2"
      />
      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-white)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70 md:w-1/3"
      >
        <option value="">All Categories</option>
        {Array.isArray(categories) &&
          categories.map((c) => (
            <option key={String(c._id)} value={String(c._id)}>
              {c.name}
            </option>
          ))}
      </select>
      <select
        value={sortOrder}
        onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
        className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-white)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70 md:w-1/3"
      >
        <option value="asc">Sort: A to Z</option>
        <option value="desc">Sort: Z to A</option>
      </select>
    </div>
  );
}

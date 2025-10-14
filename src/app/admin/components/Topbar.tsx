"use client";

import React from "react";
import { Search, User } from "lucide-react";

const Topbar: React.FC = () => {
  return (
    <header className="w-full sticky top-0 z-50 bg-[var(--color-white)] border-b border-[var(--border-color)] shadow-sm">
      <div className="flex flex-wrap items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <User />
          <h1 className="text-lg font-bold text-[#1E0E62]">
            Akash <span className="text-[var(--color-primary)]">Inventory</span>
          </h1>
        </div>

        <div className="flex items-center gap-4 mt-2 md:mt-0">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search Products, Orders, Warehouses..."
              className="pl-9 pr-4 py-2 text-sm rounded-md border border-[var(--border-color)] w-full focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
            />
          </div>

          <div className="h-9 w-9 rounded-full flex items-center justify-center bg-[var(--color-primary)] text-white hover:scale-105 transition-transform">
            <User width={18} height={18} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;

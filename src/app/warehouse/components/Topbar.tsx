// Topbar.tsx (client)
"use client";

import React, { JSX, useEffect, useRef, useState } from "react";
import { Search, User } from "lucide-react";

type WarehouseMe = { _id: string; name?: string };
type UserMe = { _id: string; name: string; email: string; role?: string; warehouses?: WarehouseMe[] };

export default function Topbar(): JSX.Element {
  const [me, setMe] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadMe = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        // Important: include credentials so httpOnly cookie is sent
        const res = await fetch("/api/user/me", { method: "GET", credentials: "include" });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body?.error ?? `Failed (${res.status})`);
          return;
        }

        const body = await res.json();
        const u: UserMe = body?.user ?? body;
        setMe(u);
      } catch (err) {
        setError("Failed to load user info");
        // optional debug
        // console.error("Topbar loadMe error:", err);
      } finally {
        setLoading(false);
      }
    };

    void loadMe();
  }, []);

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const name = me?.name ?? "User";
  const email = me?.email ?? "no-email@example.com";
  const pwh = me?.warehouses && me.warehouses.length ? me.warehouses[0] : undefined;
  const warehouseName = pwh?.name ?? pwh?._id ?? "No warehouse selected";

  return (
    <header className="w-full sticky top-0 z-50 bg-[var(--color-white)] border-b border-[var(--border-color)] shadow-sm">
      <div className="flex flex-wrap items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <User />
          <h1 className="text-lg font-bold text-[#1E0E62]">
            Akash <span className="text-[var(--color-primary)]">Inventory</span>
            {!loading && me && <span className="ml-2 text-xs font-medium text-[var(--text-muted)]">({warehouseName})</span>}
          </h1>
        </div>

        <div className="flex items-center gap-4 mt-2 md:mt-0">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-muted)]" />
            <input type="text" placeholder="Search Products, Orders, Warehouses..." className="pl-9 pr-4 py-2 text-sm rounded-md border border-[var(--border-color)] w-full focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all" />
          </div>

          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setOpen(p => !p)} className="h-9 w-9 rounded-full flex items-center justify-center bg-[var(--color-primary)] text-white hover:scale-105 transition-transform">
              <User width={18} height={18} />
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-64 bg-[var(--color-white)] border border-[var(--border-color)] rounded-lg shadow-lg py-3 px-4 text-sm">
                {loading ? (
                  <div className="text-xs text-[var(--text-muted)]">Loading user...</div>
                ) : error ? (
                  <div className="text-xs text-red-500">{error}</div>
                ) : (
                  <>
                    <div className="mb-2">
                      <div className="font-semibold text-[#1E0E62] truncate">{name}</div>
                      <div className="text-xs text-[var(--text-muted)] truncate">{email}</div>
                    </div>

                    <div className="pt-2 border-t border-[var(--border-color)] text-xs">
                      <div className="text-[var(--text-muted)] mb-1">Warehouse</div>
                      <div className="font-medium truncate">{warehouseName}</div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

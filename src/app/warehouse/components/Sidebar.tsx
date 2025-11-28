"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart2,
  CreditCard,
  Menu,
  LogOut,
  X as XIcon,
  Receipt,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store/store";
import { logoutUser } from "@/store/authSlice";

type Props = {
  allowedPerms?: string[]; // e.g. ["inventory","orders"]
  allowedPaths?: string[]; // e.g. ["/warehouse/inventory"]
};

const navItems = [
  { href: "/warehouse", label: "Dashboard", icon: <LayoutDashboard size={16} />, perm: null },
  { href: "/warehouse/inventory", label: "Inventory", icon: <Package size={16} />, perm: "inventory" },
  { href: "/warehouse/product", label: "Product", icon: <Package size={16} />, perm: "product" },
  { href: "/warehouse/billing", label: "Billing", icon: <CreditCard size={16} />, perm: "billing" },
  { href: "/warehouse/orders", label: "Orders", icon: <ShoppingCart size={16} />, perm: "orders" },
  { href: "/warehouse/reports", label: "Reports", icon: <BarChart2 size={16} />, perm: "reports" },
] as const;

const WarehouseSidebar: React.FC<Props> = ({ allowedPerms = [], allowedPaths = [] }) => {
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  // replace the existing isActive (and add normalizePath) with this
const normalizePath = (p: string) => {
  if (!p) return "/";
  // remove trailing slashes but keep single leading slash
  const cleaned = p.replace(/\/+$/, "");
  return cleaned === "" ? "/" : cleaned;
};

const isActive = (href: string) => {
  const current = normalizePath(pathname);
  const target = normalizePath(href);

  // Make dashboard (/warehouse) active ONLY on exact match.
  // For other routes allow exact match OR children (startsWith).
  if (target === "/warehouse") {
    return current === "/warehouse";
  }

  return current === target || current.startsWith(target + "/");
};


  const linkClass = (href: string) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
      isActive(href)
        ? "bg-[var(--color-primary)] text-white shadow-sm"
        : "text-[var(--text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-neutral)]"
    }`;

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      router.push("/");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const canAccess = (perm: string | null, href: string) => {
    if (!perm) return true; // dashboard allowed to all logged users
    // prefer allowedPerms, fallback to allowedPaths
    if (allowedPerms.length) return allowedPerms.includes(perm);
    if (allowedPaths.length) return allowedPaths.includes(href);
    return false;
  };

  const SidebarContent = () => (
    <nav className="px-4 py-6 h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Warehouse</h3>
        <div className="flex flex-col gap-1">
          {navItems.map((item) => {
            const allowed = canAccess(item.perm, item.href);
            if (!allowed) {
              // show as disabled (so user sees what's possible but can't click)
              return (
                <div key={item.href} className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-300 cursor-not-allowed" title="No access">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </div>
              );
            }

            return (
              <Link key={item.href} href={item.href} className={linkClass(item.href)} aria-current={isActive(item.href) ? "page" : undefined}>
                {item.icon}
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-auto">
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition" aria-label="Logout">
          <LogOut size={16} />
          Logout
        </button>
        <div className="mt-4 text-xs text-gray-500">© {new Date().getFullYear()} BlackOS Inventory</div>
      </div>
    </nav>
  );

  return (
    <>
      {/* mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button aria-label="Open menu" onClick={() => setOpen(s => !s)} className="p-2 bg-[var(--color-white)] rounded-md shadow">
          <Menu size={20} />
        </button>
      </div>

      <aside className="hidden lg:flex flex-col justify-between w-64 bg-[var(--color-white)] border-r border-[var(--border-color)] min-h-screen fixed">
        <div>
          <div className="px-4 py-4 border-b border-[var(--border-color)]">
            <h2 className="text-lg font-bold text-[var(--color-primary)]">Warehouse</h2>
            <p className="text-xs text-gray-500">Manager panel</p>
          </div>
          <SidebarContent />
        </div>
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.aside ref={sidebarRef} initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} transition={{ type: "spring", stiffness: 90, damping: 20 }} className="fixed inset-y-0 left-0 z-50 w-64 bg-[var(--color-white)] shadow-lg flex flex-col">
              <div className="px-4 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-primary)]">Warehouse</h2>
                  <p className="text-xs text-gray-500">Manager panel</p>
                </div>
                <button aria-label="Close menu" onClick={() => setOpen(false)} className="p-1">
                  <XIcon size={18} />
                </button>
              </div>
              <SidebarContent />
            </motion.aside>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.35 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 bg-black z-40" onClick={() => setOpen(false)} />
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default WarehouseSidebar;

"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch } from "react-redux";
import { logoutUser } from "@/store/authSlice";
import { AppDispatch } from "@/store/store";
import {
  LayoutDashboard,
  Package,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  LogOut,
} from "lucide-react";

type NavItem = { href: string; label: string };
type Section = {
  key: string;
  icon: React.ReactNode;
  label: string;
  items: NavItem[];
};

const sections: Section[] = [
  {
    key: "dashboards",
    icon: <LayoutDashboard size={18} />,
    label: "Dashboards",
    items: [
      { href: "/admin", label: "Admin Dashboard" },
      { href: "/admin/warehouse", label: "Store Manager" },
      { href: "/admin/user", label: "User Manager" },
      { href: "/admin/driver", label: "Driver Manager" },
    ],
  },
  {
    key: "core",
    icon: <Package size={18} />,
    label: "Core Modules",
    items: [
      { href: "/admin/product", label: "Products" },
      { href: "/admin/purchase", label: "Purchase" },
      { href: "/admin/purchase-credit-debit", label: "Purchase Credit / Debit" },
      { href: "/admin/inventory", label: "Inventory" },
      { href: "/admin/category", label: "Categories" },
      { href: "/admin/billing", label: "Billing" },
      { href: "/admin/payment", label: "Payment / Customer" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/returns", label: "Returns & Transfers" },
      { href: "/admin/reports", label: "Reports" },
    ],
  },
  {
    key: "settings",
    icon: <Settings size={18} />,
    label: "Settings",
    items: [
      { href: "/admin/general", label: "General" },
      { href: "/admin/settings/tax", label: "Tax & HSN" },
      { href: "/admin/settings/notifications", label: "Notifications" },
      { href: "/admin/settings/backup", label: "Backup & Restore" },
    ],
  },
];

const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-open active section
  useEffect(() => {
    if (!pathname) return;

    let bestSection: string | null = null;
    let bestLen = -1;

    sections.forEach((section) =>
      section.items.forEach((item) => {
        const href = item.href;
        if (
          pathname === href ||
          pathname === `${href}/` ||
          pathname.startsWith(`${href}/`)
        ) {
          if (href.length > bestLen) {
            bestLen = href.length;
            bestSection = section.key;
          }
        }
      })
    );

    setOpenMenu(bestSection);
    setMobileOpen(false);
  }, [pathname]);

  // Close mobile sidebar on outside click
  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        setMobileOpen(false);
      }
    };

    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
    } catch {}

    try {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_role");
      localStorage.removeItem("token");
      localStorage.removeItem("role");
    } catch {}

    router.replace("/");
  };

  const linkClass = (href: string) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 truncate
     ${
       pathname === href
         ? "bg-[var(--color-primary)] text-white shadow-md"
         : "text-[var(--text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-neutral)]"
     }`;

  const sectionHeaderClass = (active: boolean) =>
    `w-full flex items-center justify-between gap-2 text-sm font-semibold mb-2 ${
      active
        ? "text-[var(--color-primary)]"
        : "text-[var(--text-primary)]"
    }`;

  const SidebarContent = (
    <nav className="flex flex-col h-full lg:mt-14">
      <div className="px-4 py-6">
        {sections.map((section) => {
          const isOpen = openMenu === section.key;

          return (
            <div key={section.key} className="mb-6">
              <button
                onClick={() =>
                  setOpenMenu((prev) =>
                    prev === section.key ? null : section.key
                  )
                }
                aria-expanded={isOpen}
                className={sectionHeaderClass(isOpen)}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[var(--text-secondary)]">
                    {section.icon}
                  </span>
                  <span>{section.label}</span>
                </span>
                <span className="text-[var(--text-secondary)]">
                  {isOpen ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    className="ml-2 mt-2 flex flex-col gap-1"
                  >
                    {section.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={linkClass(item.href)}
                        >
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-4 border-t border-[var(--border-color)]">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </nav>
  );

  return (
    <>
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileOpen((s) => !s)}
          className="p-2 rounded-md bg-white shadow text-[var(--text-primary)]"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </div>

      <aside className="hidden lg:flex flex-col justify-between w-64 bg-white border-r border-[var(--border-color)] min-h-screen fixed left-0 top-0">
        <div className="h-full overflow-y-auto">{SidebarContent}</div>
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              ref={sidebarRef}
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-lg"
            >
              <div className="h-full overflow-y-auto">
                {SidebarContent}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.45 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 bg-black"
              onClick={() => setMobileOpen(false)}
            />
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;

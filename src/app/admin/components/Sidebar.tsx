"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Package,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const Sidebar: React.FC = () => {
  const [openMenu, setOpenMenu] = useState<string | null>("dashboards");
  const [isOpen, setIsOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  const toggleMenu = (menu: string) => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  // Close sidebar on outside click (mobile only)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close sidebar on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const linkClass = (href: string) =>
    `flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200
     ${
       pathname === href
         ? "bg-[var(--color-primary)] text-white shadow-sm"
         : "text-[var(--text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-neutral)]"
     }`;

  const SidebarContent = () => (
    <nav className="py-6 px-4 overflow-y-auto flex-1">
      {[
        {
          key: "dashboards",
          icon: <LayoutDashboard size={16} />,
          label: "Dashboards",
          items: [
            { href: "/admin", label: "Admin Dashboard" },
            { href: "/admin/warehouse", label: "Warehouse Manager" },
            { href: "/admin/driver", label: "Driver Dashboard" },
            { href: "/admin/auditor", label: "Auditor Dashboard" },
          ],
        },
        {
          key: "core",
          icon: <Package size={16} />,
          label: "Core Modules",
          items: [
            { href: "/admin/inventory", label: "Inventory Module" },
            { href: "/admin/billing", label: "Billing Module" },
            { href: "/admin/returns", label: "Returns & Transfers" },
            { href: "/admin/users", label: "User & Role Management" },
            { href: "/admin/reports", label: "Reports" },
            { href: "/admin/audit", label: "Audit Logs" },
          ],
        },
        {
          key: "settings",
          icon: <Settings size={16} />,
          label: "Settings",
          items: [
            { href: "/admin/settings/general", label: "General Settings" },
            { href: "/admin/settings/tax", label: "Tax & HSN Codes" },
            { href: "/admin/settings/notifications", label: "Notifications" },
            { href: "/admin/settings/backup", label: "Backup & Restore" },
          ],
        },
      ].map((section) => (
        <div key={section.key} className="mb-6">
          <button
            onClick={() => toggleMenu(section.key)}
            className="w-full flex items-center justify-between text-sm font-semibold text-[var(--text-primary)] mb-2"
          >
            <span className="flex items-center gap-2">
              {section.icon}
              {section.label}
            </span>
            {openMenu === section.key ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </button>

          <AnimatePresence>
            {openMenu === section.key && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="ml-6 space-y-1"
              >
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={linkClass(item.href)}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile Topbar */}
      <div className="lg:hidden fixed top-15 px-4 py-3 bg-[var(--color-white)] border-b border-[var(--border-color)]">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="text-[var(--text-primary)]"
        >
          <Menu size={24} />
        </button>
        
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col justify-between w-64 bg-[var(--color-white)] border-r border-[var(--border-color)] min-h-screen fixed">
        {SidebarContent()}
        <footer className="px-4 py-3 text-xs text-gray-500 border-t border-[var(--border-color)]">
          © {new Date().getFullYear()}  Inventory
        </footer>
      </aside>

      {/* Mobile Sidebar (overlay style) */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 80, damping: 20 }}
              ref={sidebarRef}
              className="fixed inset-y-0 left-0 z-50 bg-[var(--color-white)] w-64 shadow-lg flex flex-col justify-between"
            >
              {SidebarContent()}
              <footer className="px-4 py-3 text-xs text-gray-500 border-t border-[var(--border-color)]">
                © {new Date().getFullYear()} BlackOS Inventory
              </footer>
            </motion.div>

            {/* Dark overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setIsOpen(false)}
            />
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;

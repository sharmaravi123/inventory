"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import {
  fetchWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  Warehouse,
} from "@/store/warehouseSlice";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";

const addrSnippet = (a?: string) => (a && a.length > 60 ? a.slice(0, 60) + "…" : a || "—");

function getCreatedAt(w: Warehouse): string | undefined {
  return (w as unknown as { createdAt?: string }).createdAt;
}

const backdrop = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modal = {
  hidden: { scale: 0.96, opacity: 0, y: 10 },
  visible: { scale: 1, opacity: 1, y: 0 },
};

const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0 },
};

export default function WarehouseOverview() {
  const dispatch = useDispatch<AppDispatch>();
  const { list: warehouses, loading } = useSelector((s: RootState) => s.warehouse);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    dispatch(fetchWarehouses());
  }, [dispatch]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return warehouses.slice();
    return warehouses.filter(
      w =>
        w.name.toLowerCase().includes(q) ||
        (w.address || "").toLowerCase().includes(q)
    );
  }, [warehouses, query]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setAddress("");
    setShowModal(true);
  };

  const openEdit = (w: Warehouse) => {
    setEditing(w);
    setName(w.name);
    setAddress(w.address || "");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Please enter a warehouse name.");
      return;
    }
    try {
      if (editing) {
        await dispatch(
          updateWarehouse({
            id: editing._id,
            name: name.trim(),
            address: address.trim(),
          })
        );
      } else {
        await dispatch(
          createWarehouse({
            name: name.trim(),
            address: address.trim(),
          })
        );
      }
      setShowModal(false);
      setEditing(null);
      setName("");
      setAddress("");
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Try again.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this warehouse? This action cannot be undone.")) return;
    try {
      await dispatch(deleteWarehouse(id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete.");
    }
  };

  const totalWarehouses = warehouses.length;

  return (
    <div className="min-h-screen bg-[var(--color-neutral)] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-white)] px-3 py-1 text-xs font-medium text-[var(--color-primary)] shadow-sm border border-[var(--color-neutral)]">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-success)]" />
              Warehouse Management
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--color-sidebar)] flex items-center gap-2">
              <span className="rounded-xl bg-[var(--color-white)] border border-[var(--color-neutral)] px-2 py-1 text-lg shadow-sm">
                🏭
              </span>
              Warehouses
            </h1>
            <p className="text-sm md:text-base text-[var(--color-sidebar)] opacity-70 max-w-xl">
              Create and maintain all your warehouse locations with a clear, structured
              view for your team.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto"
          >
            <div className="flex-1 min-w-0">
              <div className="group flex items-center gap-2 rounded-full border border-[var(--color-neutral)] bg-[var(--color-white)] px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-[var(--color-primary)]/70">
                <Search className="w-4 h-4 text-[var(--color-secondary)] shrink-0" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by name or address"
                  className="w-full min-w-0 bg-transparent text-sm outline-none text-[var(--color-sidebar)] placeholder:text-[var(--color-sidebar)]/60"
                  aria-label="Search warehouses"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="ml-1 rounded-full p-1 hover:bg-[var(--color-neutral)] transition"
                  >
                    <X className="w-3 h-3 text-[var(--color-secondary)]" />
                  </button>
                )}
              </div>
            </div>

            <motion.button
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-white)] shadow-md"
            >
              <Plus className="w-4 h-4" />
              Add Warehouse
            </motion.button>
          </motion.div>
        </header>

        {/* STATS */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-[var(--color-white)] border border-[var(--color-neutral)] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-sidebar)] opacity-70">
                Total warehouses
              </span>
              <span className="rounded-full bg-[var(--color-neutral)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-sidebar)] opacity-70">
                Active
              </span>
            </div>
            <div className="text-3xl font-extrabold text-[var(--color-sidebar)]">
              {totalWarehouses}
            </div>
            <p className="text-xs text-[var(--color-sidebar)] opacity-60 mt-1">
              All locations currently available in the system.
            </p>
          </div>

          <div className="rounded-xl bg-[var(--color-white)] border border-[var(--color-neutral)] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-sidebar)] opacity-70">
                Search results
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[var(--color-sidebar)]">
                {filtered.length}
              </span>
              <span className="text-xs text-[var(--color-sidebar)] opacity-60">
                match{filtered.length !== 1 ? "es" : ""} found
              </span>
            </div>
            <p className="text-xs text-[var(--color-sidebar)] opacity-60 mt-1">
              Filtered by the current search query.
            </p>
          </div>

          <div className="rounded-xl bg-[var(--color-white)] border border-[var(--color-neutral)] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-sidebar)] opacity-70">
                Short guide
              </span>
            </div>
            <ul className="text-xs text-[var(--color-sidebar)] opacity-70 space-y-1">
              <li>• Edit to rename or update address.</li>
              <li>• Delete removes the warehouse permanently.</li>
              <li>• Hover a row to highlight it clearly.</li>
            </ul>
          </div>
        </section>

        {/* TABLE */}
        <section className="bg-[var(--color-white)] border border-[var(--color-neutral)] rounded-xl shadow-sm mt-2 overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-neutral)] flex items-center justify-between">
            <h2 className="text-sm md:text-base font-semibold text-[var(--color-sidebar)]">
              Warehouse list
            </h2>
            <span className="text-[11px] rounded-full bg-[var(--color-neutral)] px-3 py-1 font-medium text-[var(--color-sidebar)] opacity-80">
              {filtered.length} item{filtered.length !== 1 ? "s" : ""} visible
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="text-xs uppercase tracking-wide bg-[var(--color-neutral)] text-[var(--color-sidebar)] opacity-80">
                <tr>
                  <th className="p-4 text-left font-semibold">Name</th>
                  <th className="p-4 text-left font-semibold">Address</th>
                  <th className="p-4 text-left font-semibold">Created</th>
                  <th className="p-4 text-center font-semibold">Actions</th>
                </tr>
              </thead>

              <motion.tbody initial="hidden" animate="visible">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-t border-[var(--color-neutral)]">
                      <td className="p-4">
                        <div className="h-4 rounded bg-[var(--color-neutral)] animate-pulse w-40" />
                      </td>
                      <td className="p-4">
                        <div className="h-4 rounded bg-[var(--color-neutral)] animate-pulse w-56" />
                      </td>
                      <td className="p-4">
                        <div className="h-4 rounded bg-[var(--color-neutral)] animate-pulse w-24" />
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex gap-2">
                          <div className="h-8 w-8 rounded-full bg-[var(--color-neutral)] animate-pulse" />
                          <div className="h-8 w-8 rounded-full bg-[var(--color-neutral)] animate-pulse" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr className="border-t border-[var(--color-neutral)]">
                    <td
                      colSpan={4}
                      className="p-8 text-center text-sm text-[var(--color-secondary)]"
                    >
                      No warehouses found. Try a different search or create a new one.
                    </td>
                  </tr>
                ) : (
                  filtered.map(w => (
                    <motion.tr
                      key={w._id}
                      className="border-t border-[var(--color-neutral)] hover:bg-[var(--color-neutral)] transition-colors"
                      variants={rowVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <td className="p-4 align-top">
                        <div className="font-semibold text-[var(--color-sidebar)]">
                          {w.name}
                        </div>
                        <div className="text-[11px] text-[var(--color-sidebar)] opacity-70 mt-1">
                          {addrSnippet(w.address)}
                        </div>
                      </td>

                      <td className="p-4 align-top">
                        <div className="text-sm text-[var(--color-sidebar)]">
                          {w.address || "—"}
                        </div>
                      </td>

                      <td className="p-4 align-top text-sm text-[var(--color-sidebar)] whitespace-nowrap">
                        {getCreatedAt(w)
                          ? new Date(getCreatedAt(w) as string).toLocaleDateString()
                          : "—"}
                      </td>

                      <td className="p-4 align-top text-center">
                        <div className="inline-flex items-center gap-2 justify-center flex-wrap">
                          <button
                            onClick={() => openEdit(w)}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-neutral)] bg-[var(--color-white)] px-3 py-1 text-xs font-medium text-[var(--color-sidebar)] hover:border-[var(--color-primary)] hover:bg-[var(--color-neutral)] transition"
                            title={`Edit ${w.name}`}
                            aria-label={`Edit ${w.name}`}
                          >
                            <Pencil className="w-3 h-3 text-[var(--color-primary)]" />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => handleDelete(w._id)}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-error)] bg-[var(--color-white)] px-3 py-1 text-xs font-medium text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition"
                            title={`Delete ${w.name}`}
                            aria-label={`Delete ${w.name}`}
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </motion.tbody>
            </table>
          </div>
        </section>

        {/* MODAL */}
        <AnimatePresence>
          {showModal && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              variants={backdrop}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setShowModal(false)}
                aria-hidden
              />

              <motion.form
                variants={modal}
                initial="hidden"
                animate="visible"
                exit="hidden"
                onSubmit={e => {
                  e.preventDefault();
                  handleSave();
                }}
                className="relative bg-[var(--color-white)] rounded-2xl w-full max-w-lg mx-4 p-6 shadow-2xl border border-[var(--color-neutral)]"
                role="dialog"
                aria-modal="true"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-sidebar)]">
                      {editing ? "Edit warehouse" : "Create warehouse"}
                    </h3>
                    <p className="text-xs text-[var(--color-sidebar)] opacity-70 mt-1">
                      Give this warehouse a clear name and optional address for your team.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="p-2 rounded-full hover:bg-[var(--color-neutral)] transition"
                  >
                    <X className="w-4 h-4 text-[var(--color-secondary)]" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-[var(--color-sidebar)] opacity-80">
                      Name
                    </label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-neutral)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
                      placeholder="Main warehouse, East hub, etc."
                      aria-label="Warehouse name"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-[var(--color-sidebar)] opacity-80">
                      Address (optional)
                    </label>
                    <textarea
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-neutral)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70 h-24 resize-none"
                      placeholder="Street, city, state, etc."
                      aria-label="Warehouse address"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="w-full sm:w-auto rounded-lg border border-[var(--color-neutral)] bg-[var(--color-white)] px-4 py-2 text-sm font-medium text-[var(--color-sidebar)] hover:bg-[var(--color-neutral)] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto rounded-lg bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-[var(--color-white)] shadow-md hover:brightness-95 transition"
                  >
                    {editing ? "Update warehouse" : "Create warehouse"}
                  </button>
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

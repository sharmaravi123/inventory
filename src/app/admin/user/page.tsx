"use client";

import React, { JSX, useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchWarehouses } from "@/store/warehouseSlice";
import {
  createUser,
  fetchUsers,
  updateUserAccess,
  deleteUser,
} from "@/store/userSlice";
import type { RootState } from "@/store/store";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, Search, Pencil } from "lucide-react";

type AccessLevel = "limited" | "all";

interface WarehouseShort {
  _id: string;
  name: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  role?: string;
  warehouses?: Array<string | WarehouseShort>;
  access?: { level?: AccessLevel; permissions?: string[] };
}

const permsList = ["inventory", "orders", "reports", "billing", "product"] as const;

export default function CreateUserPage(): JSX.Element {
  const dispatch = useAppDispatch();
  const warehouses = useAppSelector(
    (s: RootState) => s.warehouse.list
  ) as WarehouseShort[];
  const users = useAppSelector((s: RootState) => s.user.list) as User[];
  const loadingUsers = useAppSelector((s: RootState) => s.user.loading);

  const [isOpen, setIsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("limited");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    dispatch(fetchWarehouses());
    dispatch(fetchUsers());
  }, [dispatch]);

  useEffect(() => {
    if (permissions.length === permsList.length) {
      setAccessLevel("all");
    } else {
      setAccessLevel("limited");
    }
  }, [permissions]);

  const resetForm = () => {
    setEditingUser(null);
    setName("");
    setEmail("");
    setPassword("");
    setSelectedWarehouseId("");
    setAccessLevel("limited");
    setPermissions([]);
  };

  const openForCreate = () => {
    resetForm();
    setIsOpen(true);
  };

  const openForEdit = (u: User) => {
    if (u.role === "admin") return;
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email);
    setPassword("");
    const wid =
      Array.isArray(u.warehouses) && u.warehouses.length
        ? typeof u.warehouses[0] === "string"
          ? u.warehouses[0]
          : u.warehouses[0]._id
        : "";
    setSelectedWarehouseId(wid);
    setAccessLevel(u.access?.level ?? "limited");
    setPermissions(u.access?.permissions ?? []);
    setIsOpen(true);
  };

  const togglePermission = (perm: string) =>
    setPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );

  const handleCreateOrUpdate = async () => {
    if (!name.trim() || !email.trim()) {
      alert("Name and email are required");
      return;
    }

    try {
      if (editingUser) {
        await dispatch(
          updateUserAccess({
            userId: editingUser._id,
            access: { level: accessLevel, permissions },
            warehouseId: selectedWarehouseId || undefined,
          })
        );
      } else {
        await dispatch(
          createUser({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password: password || undefined,
            warehouseId: selectedWarehouseId || undefined,
            access: { level: accessLevel, permissions },
          })
        );
      }
      await dispatch(fetchUsers());
      setIsOpen(false);
      resetForm();
    } catch (e) {
      console.error(e);
      alert("Operation failed");
    }
  };

  const grantFullAccess = async (userId: string) => {
    try {
      await dispatch(
        updateUserAccess({
          userId,
          access: { level: "all", permissions: [...permsList] },
        })
      );
      await dispatch(fetchUsers());
    } catch (e) {
      console.error(e);
    }
  };

  const changeUserWarehouse = async (userId: string, warehouseId?: string) => {
    try {
      await dispatch(
        updateUserAccess({
          userId,
          warehouseId: warehouseId ?? "",
        })
      );
      await dispatch(fetchUsers());
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Delete user?")) return;
    try {
      await dispatch(deleteUser({ userId }));
      await dispatch(fetchUsers());
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const onlyUsers = users.filter(u => u.role !== "admin");
    if (!q) return onlyUsers;
    return onlyUsers.filter(
      u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, query]);

  const userWarehouseId = (u: User): string => {
    if (!u.warehouses || !Array.isArray(u.warehouses) || u.warehouses.length === 0) {
      return "";
    }
    const first = u.warehouses[0];
    return typeof first === "string" ? first : first._id;
  };

  const userWarehouseName = (u: User): string => {
    const id = userWarehouseId(u);
    if (!id) return "None";
    const warehouse = warehouses.find(w => w._id === id);
    return warehouse ? warehouse.name : "Unknown";
  };

  const totalUsers = filtered.length;
  const totalWarehouses = warehouses.length;
  const fullAccessUsers = filtered.filter(
    u => u.access?.level === "all"
  ).length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_var(--color-secondary)_0,_var(--color-neutral)_55%,_var(--color-neutral)_100%)] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-chip-bg)] px-3 py-1 text-xs font-medium text-[var(--color-primary)] shadow-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-success)]" />
              User & Access Control Center
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--color-sidebar)]">
              Users & Permissions
            </h1>
            <p className="text-sm md:text-base text-[var(--color-muted)] max-w-xl">
              Create users, assign warehouses and finely control what each user
              can access across your inventory platform.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto"
          >
            <div className="flex-1 min-w-0">
              <div className="group flex items-center gap-2 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-[var(--color-primary)]/70">
                <Search className="w-4 h-4 text-[var(--color-muted)] shrink-0" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by name or email"
                  className="w-full min-w-0 bg-transparent text-sm outline-none text-[var(--color-sidebar)] placeholder:text-[var(--color-muted)]"
                />
              </div>
            </div>

            <motion.button
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={openForCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-white)] shadow-lg shadow-[var(--color-primary)]/30"
            >
              <Plus className="w-4 h-4" />
              New User
            </motion.button>
          </motion.div>
        </header>

        {/* OVERVIEW / STATS */}
        <aside className="w-full">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <div className="rounded-2xl bg-[var(--color-card)] border border-[var(--color-border-soft)] p-4 shadow-lg shadow-[var(--color-secondary)]/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                  Total Users
                </span>
                <span className="rounded-full bg-[var(--color-chip-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
                  Active
                </span>
              </div>
              <div className="text-3xl font-extrabold text-[var(--color-sidebar)]">
                {totalUsers}
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Only non-admin users listed here.
              </p>
            </div>

            <div className="rounded-2xl bg-[var(--color-card)] border border-[var(--color-border-soft)] p-4 shadow-lg shadow-[var(--color-secondary)]/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                  Full Access
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[var(--color-sidebar)]">
                  {fullAccessUsers}
                </span>
                <span className="text-xs text-[var(--color-muted)]">
                  of {totalUsers} users
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                One click to grant all permissions.
              </p>
            </div>

            <div className="rounded-2xl bg-[var(--color-card)] border border-[var(--color-border-soft)] p-4 shadow-lg shadow-[var(--color-secondary)]/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                  Warehouses
                </span>
              </div>
              <div className="text-3xl font-extrabold text-[var(--color-sidebar)]">
                {totalWarehouses}
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Assign a primary warehouse to each user.
              </p>
            </div>
          </motion.div>
        </aside>

        {/* PERMISSION PRESETS – FULL WIDTH BELOW STATS */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-[var(--color-card)] border border-[var(--color-border-soft)] p-4 shadow-lg shadow-[var(--color-secondary)]/25"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[var(--color-sidebar)]">
                Permission presets
              </h3>
              <span className="text-[10px] text-[var(--color-muted)]">
                Used inside the user modal
              </span>
            </div>
            <p className="text-xs text-[var(--color-muted)] mb-3">
              These are the standard permission types you assign to your team members.
            </p>
            <div className="flex flex-wrap gap-2">
              {permsList.map(p => (
                <span
                  key={p}
                  className="rounded-full bg-[var(--color-chip-bg)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-primary)]"
                >
                  {p}
                </span>
              ))}
            </div>
          </motion.div>
        </section>

        {/* MAIN – USER LIST FULL WIDTH */}
        <main>
          <section>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-[var(--color-card)] border border-[var(--color-border-soft)] p-4 md:p-5 shadow-lg shadow-[var(--color-secondary)]/25"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base md:text-lg font-semibold text-[var(--color-sidebar)]">
                  Team members
                </h2>
                <span className="rounded-full bg-[var(--color-chip-bg)] px-3 py-1 text-xs font-medium text-[var(--color-primary)]">
                  {totalUsers} users
                </span>
              </div>

              {loadingUsers ? (
                <div className="space-y-3">
                  {[0, 1, 2].map(key => (
                    <div
                      key={key}
                      className="h-16 rounded-xl bg-[var(--color-neutral)] animate-pulse"
                    />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-[var(--color-muted)]">
                    No users found. Try a different search or create a new user.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filtered.map(u => (
                    <motion.article
                      key={u._id}
                      layout
                      whileHover={{ y: -2, scale: 1.01 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      className="flex flex-wrap gap-4 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-4 shadow-sm hover:shadow-md"
                    >
                      <div className="flex-1 min-w-[180px] space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm md:text-base font-semibold text-[var(--color-sidebar)] truncate">
                            {u.name}
                          </h3>
                          {u.access?.level === "all" && (
                            <span className="rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-success)]">
                              Full access
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-muted)] truncate">
                          {u.email}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-3 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-[var(--color-muted)]">Access:</span>
                            <span className="rounded-full bg-[var(--color-chip-bg)] px-2 py-0.5 font-medium text-[var(--color-primary)] capitalize">
                              {u.access?.level ?? "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[var(--color-muted)]">Warehouse:</span>
                            <span className="font-medium text-[var(--color-sidebar)] truncate">
                              {userWarehouseName(u)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <button
                          onClick={() => grantFullAccess(u._id)}
                          className="rounded-full border border-[var(--color-success)] bg-[var(--color-success)]/10 px-3 py-1 text-xs font-semibold text-[var(--color-success)] hover:bg-[var(--color-success)]/16 transition"
                        >
                          Grant all
                        </button>

                        <select
                          value={userWarehouseId(u)}
                          onChange={e => changeUserWarehouse(u._id, e.target.value)}
                          className="max-w-[180px] rounded-full border border-[var(--color-border-soft)] bg-[var(--color-neutral)] px-3 py-1 text-xs font-medium text-[var(--color-sidebar)] outline-none"
                        >
                          <option value="">No warehouse</option>
                          {warehouses.map(w => (
                            <option key={w._id} value={w._id}>
                              {w.name}
                            </option>
                          ))}
                        </select>

                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => openForEdit(u)}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-neutral)] px-3 py-1 text-xs font-medium text-[var(--color-sidebar)] hover:border-[var(--color-primary)] hover:shadow-sm transition"
                            title="Edit"
                            aria-label="Edit User"
                          >
                            <Pencil className="w-3 h-3 text-[var(--color-primary)]" />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => handleDelete(u._id)}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-error)] bg-[var(--color-error)]/5 px-3 py-1 text-xs font-medium text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition"
                            title="Delete"
                            aria-label="Delete User"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </motion.article>
                  ))}
                </div>
              )}
            </motion.div>
          </section>
        </main>

        {/* MODAL */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
              />

              <motion.form
                onSubmit={e => {
                  e.preventDefault();
                  handleCreateOrUpdate();
                }}
                initial={{ scale: 0.96, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 10 }}
                className="relative z-10 w-full max-w-2xl rounded-2xl bg-[var(--color-card)] border border-[var(--color-border-soft)] p-6 shadow-2xl"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-sidebar)]">
                      {editingUser ? "Edit user" : "Create user"}
                    </h3>
                    <p className="text-xs text-[var(--color-muted)] mt-1">
                      Define user identity, map a warehouse and configure fine-grained
                      permissions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-full p-2 hover:bg-[var(--color-neutral)] transition"
                  >
                    <X className="w-4 h-4 text-[var(--color-muted)]" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--color-muted)]">
                      Full name
                    </label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-neutral)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--color-muted)]">
                      Email
                    </label>
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-neutral)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--color-muted)]">
                      Password{" "}
                      {editingUser ? (
                        <span className="text-[10px] text-[var(--color-muted)]">
                          (leave blank to keep)
                        </span>
                      ) : null}
                    </label>
                    <input
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      type="password"
                      className="w-full rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-neutral)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--color-muted)]">
                      Warehouse
                    </label>
                    <select
                      value={selectedWarehouseId}
                      onChange={e => setSelectedWarehouseId(e.target.value)}
                      className="w-full rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-neutral)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
                    >
                      <option value="">No warehouse</option>
                      {warehouses.map(w => (
                        <option key={w._id} value={w._id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--color-muted)]">
                      Access level
                    </label>
                    <select
                      value={accessLevel}
                      onChange={e =>
                        setAccessLevel(e.target.value as AccessLevel)
                      }
                      className="w-full rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-neutral)] px-3 py-2 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
                    >
                      <option value="all">All permissions</option>
                      <option value="limited">Limited</option>
                    </select>
                    <p className="text-[10px] text-[var(--color-muted)] mt-1">
                      This is automatically synced based on selected permissions.
                    </p>
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium text-[var(--color-muted)]">
                      Permissions
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {permsList.map(p => {
                        const active = permissions.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => togglePermission(p)}
                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                              active
                                ? "border-[var(--color-chip-active)] bg-[var(--color-chip-active)] text-[var(--color-white)] shadow-sm"
                                : "border-[var(--color-border-soft)] bg-[var(--color-neutral)] text-[var(--color-sidebar)] hover:border-[var(--color-primary)]"
                            }`}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-full sm:w-auto rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-4 py-2 text-sm font-medium text-[var(--color-sidebar)] hover:bg-[var(--color-neutral)] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-[var(--color-white)] shadow-lg shadow-[var(--color-primary)]/30 hover:brightness-95 transition"
                  >
                    {editingUser ? "Update user" : "Create user"}
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

"use client";

import React, { JSX, useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchWarehouses } from "@/store/warehouseSlice";
import { createUser, fetchUsers, updateUserAccess, deleteUser } from "@/store/userSlice";
import type { RootState } from "@/store/store";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit3, Trash2, X, Search } from "lucide-react";

type AccessLevel = "limited" | "all";

interface WarehouseShort { _id: string; name: string; }
interface User { _id: string; name: string; email: string; role?: string; warehouses?: Array<string | WarehouseShort>; access?: { level?: AccessLevel; permissions?: string[] }; }

const permsList = ["inventory", "orders", "reports", "billing", "product"] as const;

export default function CreateUserPage(): JSX.Element {
  const dispatch = useAppDispatch();
  const warehouses = useAppSelector((s: RootState) => s.warehouse.list) as WarehouseShort[];
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

  // 🔁 Auto-sync accessLevel with permissions:
  // - all selected  -> "all"
  // - anything off  -> "limited"
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

  const openForCreate = () => { resetForm(); setIsOpen(true); };

  const openForEdit = (u: User) => {
    if (u.role === "admin") return; // admins not editable
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
    if (!name.trim() || !email.trim()) { alert("Name and email are required"); return; }

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
    if (!u.warehouses || !Array.isArray(u.warehouses) || u.warehouses.length === 0) return "";
    const first = u.warehouses[0];
    return typeof first === "string" ? first : first._id;
  };
  const userWarehouseName = (u: User): string => {
    const id = userWarehouseId(u);
    if (!id) return "None";
    return warehouses.find(w => w._id === id)?.name ?? "Unknown";
  };

  const cssVars = ({
    ["--color-primary"]: "#1A73E8",
    ["--color-secondary"]: "#A7C7E7",
    ["--color-success"]: "#00C48C",
    ["--color-warning"]: "#FFC107",
    ["--color-error"]: "#F05454",
    ["--color-neutral"]: "#F8FAFC",
    ["--color-sidebar"]: "#0F172A",
    ["--color-white"]: "#FFFFFF",
  } as Record<string, string>) as unknown as React.CSSProperties;

  return (
    <div style={cssVars} className="min-h-screen bg-[var(--color-neutral)] p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-[var(--color-sidebar)]">Users</h1>
            <p className="text-sm text-gray-600">
              Assign warehouses only to normal users. Manage access & permissions.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center bg-white border rounded-lg px-3 py-2 shadow-sm flex-1 md:flex-none w-full md:w-64 min-w-0">
              <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search users"
                className="outline-none w-full min-w-0"
              />
            </div>

            <button
              onClick={openForCreate}
              className="inline-flex items-center gap-2 bg-[var(--color-primary)] text-[var(--color-white)] px-4 py-2 rounded-lg shadow hover:brightness-95 transition whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> New User
            </button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {loadingUsers ? (
                <div className="py-12 text-center text-gray-500">Loading users…</div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-gray-500">No users found</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 gap-4">
                  {filtered.map(u => (
                    <motion.article
                      key={u._id}
                      layout
                      whileHover={{ scale: 1.01 }}
                      className="bg-[var(--color-white)] border flex flex-wrap w-auto rounded-lg p-4 shadow-sm hover:shadow-md transition gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-[var(--color-sidebar)] truncate">
                          {u.name}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">{u.email}</p>

                        <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-3">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-xs text-gray-500">Access:</span>
                            <span className="font-medium truncate">
                              {u.access?.level ?? "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-xs text-gray-500">Warehouse:</span>
                            <span className="font-medium truncate">
                              {userWarehouseName(u)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0 flex items-center gap-2 mt-3">
                        <button
                          onClick={() => grantFullAccess(u._id)}
                          className="px-3 py-1 rounded text-[var(--color-white)] bg-[var(--color-success)] hover:brightness-95 transition whitespace-nowrap"
                        >
                          Grant
                        </button>

                        <select
                          value={userWarehouseId(u)}
                          onChange={e => changeUserWarehouse(u._id, e.target.value)}
                          className="border px-2 py-1 rounded max-w-[160px] text-sm"
                        >
                          <option value="">None</option>
                          {warehouses.map(w => (
                            <option key={w._id} value={w._id}>
                              {w.name}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openForEdit(u)}
                            className="p-2 rounded hover:bg-slate-100 transition"
                            aria-label="Edit user"
                          >
                            <Edit3 className="w-5 h-5 text-[var(--color-primary)]" />
                          </button>
                          <button
                            onClick={() => handleDelete(u._id)}
                            className="p-2 rounded hover:bg-slate-100 transition"
                            aria-label="Delete user"
                          >
                            <Trash2 className="w-5 h-5 text-[var(--color-error)]" />
                          </button>
                        </div>
                      </div>
                    </motion.article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[var(--color-white)] rounded-xl p-4 shadow-lg"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold">Actions</h4>
                  <p className="text-sm text-gray-500">Create or manage users</p>
                </div>
                <button
                  onClick={openForCreate}
                  className="px-3 py-1 bg-[var(--color-primary)] text-[var(--color-white)] rounded"
                >
                  Create
                </button>
              </div>

              <div className="mt-2 space-y-2">
                <div className="text-sm text-gray-600">Total users</div>
                <div className="text-2xl font-bold text-[var(--color-sidebar)]">
                  {filtered.length}
                </div>
              </div>
            </motion.div>
          </aside>
        </main>

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
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                className="relative bg-[var(--color-white)] w-full max-w-2xl rounded-xl p-6 shadow-2xl z-10"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    {editingUser ? "Edit User" : "Create User"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded hover:bg-gray-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-600">Name</label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Email</label>
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">
                      Password {editingUser ? "(leave blank to keep)" : ""}
                    </label>
                    <input
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      type="password"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Warehouse</label>
                    <select
                      value={selectedWarehouseId}
                      onChange={e => setSelectedWarehouseId(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="">None</option>
                      {warehouses.map(w => (
                        <option key={w._id} value={w._id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">Access Level</label>
                    <select
                      value={accessLevel}
                      onChange={e => setAccessLevel(e.target.value as AccessLevel)}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="all">All</option>
                      <option value="limited">Limited</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">Permissions</label>
                    <div className="flex gap-2 flex-wrap mt-2">
                      {permsList.map(p => (
                        <label
                          key={p}
                          className={`px-3 py-1 border rounded cursor-pointer ${
                            permissions.includes(p)
                              ? "bg-[var(--color-primary)] text-white"
                              : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={permissions.includes(p)}
                            onChange={() => togglePermission(p)}
                            className="hidden"
                          />
                          {p}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 border rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-white)] rounded"
                  >
                    {editingUser ? "Update User" : "Create User"}
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

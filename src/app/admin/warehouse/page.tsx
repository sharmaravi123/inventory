"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2 } from "lucide-react";

import { AppDispatch, RootState } from "@/store/store";
import {
  fetchWarehouses,
  createWarehouse,
  deleteWarehouse,
  updateWarehouseName,
  Warehouse,
} from "@/store/warehouseSlice";
import { fetchInventory, InventoryItem } from "@/store/inventorySlice";
import DashboardStats from "../components/Warehouse/DashboardStats";
import InventoryTable from "../components/Warehouse/InventoryTable";
import { WarehouseSelector } from "../components/Warehouse/WarehouseSelector";

export default function WarehouseDashboard() {
  const dispatch = useDispatch<AppDispatch>();
  const { list: warehouses, loading: warehouseLoading } = useSelector(
    (state: RootState) => state.warehouse
  );
  const { items: inventory, loading: inventoryLoading } = useSelector(
    (state: RootState) => state.inventory
  );

  const [activeWarehouse, setActiveWarehouse] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(
    null
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    dispatch(fetchWarehouses());
    dispatch(fetchInventory());
  }, [dispatch]);

  useEffect(() => {
    if (warehouses.length && !activeWarehouse) {
      setActiveWarehouse(String(warehouses[0].id));
    }
  }, [warehouses, activeWarehouse]);

  const openEditModal = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    setName(warehouse.name);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!name) return alert("Name is required");

    if (editingWarehouse) {
      dispatch(updateWarehouseName({ id: editingWarehouse.id, name }));
    } else {
      if (!email || !username || !password)
        return alert("All fields are required");
      dispatch(createWarehouse({ name, email, username, password }));
    }

    setShowModal(false);
    setEditingWarehouse(null);
    setName("");
    setEmail("");
    setUsername("");
    setPassword("");
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this warehouse?")) {
      dispatch(deleteWarehouse(id));
    }
  };

  // ✅ Correctly filter inventory by warehouse ID
  const filteredInventory: InventoryItem[] = useMemo(() => {
    if (!activeWarehouse) return [];
    return inventory.filter(
      (item) => String(item.warehouse?.id) === activeWarehouse
    );
  }, [inventory, activeWarehouse]);

  // Stats calculation
  const totalWarehouses = warehouses?.length || 0;
  const { lowStock, outOfStock } = useMemo(() => {
    let low = 0;
    let out = 0;

    for (const item of inventory) {
      const totalItems = item.boxes * item.itemsPerBox + item.looseItems;
      const lowStockTotal =
        (item.lowStockBoxes ?? 0) * item.itemsPerBox +
        (item.lowStockItems ?? 0);

      if (totalItems === 0) out++;
      else if (totalItems <= lowStockTotal) low++;
    }
    return { lowStock: low, outOfStock: out };
  }, [inventory]);

  return (
    <div className="p-8 bg-[var(--color-neutral)] min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-[var(--color-sidebar)]">
          Warehouse Dashboard
        </h1>

        <DashboardStats
          totalInventory={totalWarehouses}
          lowStock={lowStock + outOfStock}
          pendingOrders={18}
          recentReturns={3}
          loading={warehouseLoading || inventoryLoading}
        />

        <div className="bg-[var(--color-white)] rounded-lg border p-6 space-y-4 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <WarehouseSelector
              warehouses={warehouses}
              activeWarehouse={activeWarehouse}
              setActiveWarehouse={setActiveWarehouse}
            />
            <button
              onClick={() => {
                setEditingWarehouse(null);
                setName("");
                setEmail("");
                setUsername("");
                setPassword("");
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-md hover:opacity-90 transition"
            >
              <Plus className="w-4 h-4" /> Add Warehouse
            </button>
          </div>

          {/* Warehouses Table */}
          <div className="overflow-x-auto">
            <table className="min-w-[600px] w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--color-neutral)] text-left text-xs uppercase">
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Username</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((w) => (
                  <tr
                    key={w.id}
                    className="border-b hover:bg-[var(--color-neutral)] transition"
                  >
                    <td className="p-3">{w.name}</td>
                    <td className="p-3">{w.email}</td>
                    <td className="p-3">{w.username}</td>
                    <td className="p-3 text-center flex justify-center gap-2">
                      <button onClick={() => openEditModal(w)}>
                        <Pencil className="w-4 h-4 text-blue-500" />
                      </button>
                      <button onClick={() => handleDelete(w.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <InventoryTable
            rows={filteredInventory}
            warehouse={
              warehouses.find((w) => String(w.id) === activeWarehouse)?.name ||
              "Selected"
            }
          />
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white p-6 rounded-lg w-11/12 sm:w-96 space-y-4 shadow-xl"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <h2 className="text-xl font-semibold">
                {editingWarehouse ? "Edit Warehouse" : "Create Warehouse"}
              </h2>

              <input
                type="text"
                placeholder="Warehouse Name"
                className="w-full border px-3 py-2 rounded-md"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              {!editingWarehouse && (
                <>
                  <input
                    type="email"
                    placeholder="Email"
                    className="w-full border px-3 py-2 rounded-md"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Username"
                    className="w-full border px-3 py-2 rounded-md"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    className="w-full border px-3 py-2 rounded-md"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  className="px-4 py-2 border rounded-md"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-md"
                  onClick={handleSave}
                >
                  {editingWarehouse ? "Update" : "Create"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

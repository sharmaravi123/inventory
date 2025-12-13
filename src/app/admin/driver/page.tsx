// src/app/admin/driver-manager/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  Driver,
  fetchDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
  clearDriverError,
} from "@/store/driverSlice";
import { motion, AnimatePresence } from "framer-motion";

export default function DriverManagerPage() {
  const dispatch = useAppDispatch();
  const { items, loading, saving, deletingId, error } = useAppSelector(
    (state) => state.driver
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // initial load
  useEffect(() => {
    void dispatch(fetchDrivers());
  }, [dispatch]);

  const resetForm = (): void => {
    setName("");
    setEmail("");
    setPassword("");
    setPhone("");
    setVehicleNumber("");
    setVehicleType("");
    setIsActive(true);
    setEditingId(null);
  };

  const openCreateModal = (): void => {
    resetForm();
    setLocalError(null);
    setSuccess(null);
    dispatch(clearDriverError());
    setIsModalOpen(true);
  };

  const startEdit = (driver: Driver): void => {
    setEditingId(driver._id);
    setName(driver.name);
    setEmail(driver.email);
    setPassword("");
    setPhone(driver.phone);
    setVehicleNumber(driver.vehicleNumber);
    setVehicleType(driver.vehicleType ?? "");
    setIsActive(driver.isActive);
    setSuccess(null);
    setLocalError(null);
    dispatch(clearDriverError());
    setIsModalOpen(true);
  };

  const closeModal = (): void => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    setLocalError(null);
    setSuccess(null);
    dispatch(clearDriverError());

    if (!name.trim() || !email.trim()) {
      setLocalError("Name and email are required");
      return;
    }

    if (!editingId && password.length < 6) {
      setLocalError("Password must be at least 6 characters");
      return;
    }

    try {
      if (editingId) {
        const updates = {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          vehicleNumber: vehicleNumber.trim(),
          vehicleType: vehicleType.trim() || undefined,
          isActive,
          ...(password.trim().length >= 6
            ? { password: password.trim() }
            : {}),
        };

        await dispatch(updateDriver({ id: editingId, updates })).unwrap();
        setSuccess("Driver updated successfully");
      } else {
        await dispatch(
          createDriver({
            name: name.trim(),
            email: email.trim(),
            password: password.trim(),
            phone: phone.trim(),
            vehicleNumber: vehicleNumber.trim(),
            vehicleType: vehicleType.trim() || undefined,
          })
        ).unwrap();

        setSuccess("Driver created successfully");
      }

      resetForm();
      setIsModalOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Operation failed";
      setLocalError(message);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    setLocalError(null);
    setSuccess(null);
    dispatch(clearDriverError());

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this driver?"
    );
    if (!confirmDelete) return;

    try {
      await dispatch(deleteDriver(id)).unwrap();
      if (editingId === id) {
        resetForm();
      }
      setSuccess("Driver deleted successfully");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete driver";
      setLocalError(message);
    }
  };

  const isEditing = editingId !== null;
  const globalError = error ?? localError;

  return (
    <div className="min-h-screen bg-[var(--color-neutral)] p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* HEADER */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-neutral)] bg-[var(--color-white)] px-3 py-1 text-xs font-medium text-[color:var(--color-primary)] shadow-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-success)]" />
              Driver & Fleet Management
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[color:var(--color-sidebar)]">
              Driver Manager
            </h1>
            <p
              className="text-sm md:text-base"
              style={{ color: "var(--color-sidebar)", opacity: 0.75 }}
            >
              Manage driver accounts, login access and vehicle details in one
              place.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="rounded-xl bg-[var(--color-white)] px-4 py-3 text-xs shadow-sm border border-[var(--color-neutral)]">
              <p
                className="font-medium"
                style={{ color: "var(--color-sidebar)" }}
              >
                Total drivers
              </p>
              <p
                className="mt-1 text-2xl font-extrabold"
                style={{ color: "var(--color-primary)" }}
              >
                {items.length}
              </p>
              <p
                className="mt-1 text-[11px]"
                style={{ color: "var(--color-sidebar)", opacity: 0.7 }}
              >
                {loading ? "Syncing latest drivers…" : "Including active & inactive"}
              </p>
            </div>

            <motion.button
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={openCreateModal}
              className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-white)] shadow-md"
            >
              Add Driver
            </motion.button>
          </div>
        </header>

        {/* ALERTS */}
        <div className="space-y-2">
          {globalError && (
            <div className="rounded-lg border border-[var(--color-error)] bg-[var(--color-error)]/10 px-3 py-2 text-xs font-medium text-[color:var(--color-error)]">
              {globalError}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-[var(--color-success)] bg-[var(--color-success)]/10 px-3 py-2 text-xs font-medium text-[color:var(--color-success)]">
              {success}
            </div>
          )}
        </div>

        {/* LIST SECTION */}
        <section className="rounded-xl border border-[var(--color-neutral)] bg-[var(--color-white)] p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[color:var(--color-sidebar)]">
              Drivers
            </h2>
            <span
              className="rounded-full px-3 py-1 text-[11px] font-medium"
              style={{
                backgroundColor: "var(--color-neutral)",
                color: "var(--color-sidebar)",
                opacity: 0.9,
              }}
            >
              {loading ? "Loading…" : `${items.length} record(s)`}
            </span>
          </div>

          <div className="max-h-[460px] space-y-3 overflow-y-auto text-sm">
            {items.length === 0 && !loading ? (
              <p style={{ color: "var(--color-sidebar)", opacity: 0.7 }}>
                No drivers yet. Use “Add Driver” to create the first account.
              </p>
            ) : (
              items.map((driver) => (
                <motion.article
                  key={driver._id}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="rounded-lg border border-[var(--color-neutral)] bg-[var(--color-white)] p-3 text-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className="text-sm font-semibold"
                          style={{ color: "var(--color-sidebar)" }}
                        >
                          {driver.name}
                        </p>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: driver.isActive
                              ? "rgba(0,196,140,0.1)" // success soft
                              : "rgba(240,84,84,0.08)", // error soft
                            color: driver.isActive
                              ? "var(--color-success)"
                              : "var(--color-error)",
                          }}
                        >
                          {driver.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <p
                        className="text-[11px]"
                        style={{ color: "var(--color-sidebar)", opacity: 0.75 }}
                      >
                        {driver.email}
                      </p>
                      <p
                        className="text-[11px]"
                        style={{ color: "var(--color-sidebar)", opacity: 0.75 }}
                      >
                        {driver.phone}
                      </p>

                      <p
                        className="mt-1 text-[11px]"
                        style={{ color: "var(--color-sidebar)", opacity: 0.8 }}
                      >
                        Vehicle:{" "}
                        <span className="font-mono">
                          {driver.vehicleNumber}
                        </span>{" "}
                        {driver.vehicleType
                          ? `(${driver.vehicleType})`
                          : ""}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => startEdit(driver)}
                        className="rounded-full border border-[var(--color-neutral)] bg-[var(--color-white)] px-3 py-0.5 font-medium transition hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(driver._id)}
                        disabled={deletingId === driver._id}
                        className="rounded-full border px-3 py-0.5 font-medium text-[color:var(--color-error)] transition hover:bg-[var(--color-error)]/10 disabled:opacity-50"
                        style={{
                          borderColor: "var(--color-error)",
                          backgroundColor: "var(--color-white)",
                        }}
                      >
                        {deletingId === driver._id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </motion.article>
              ))
            )}
          </div>
        </section>

        {/* MODAL: CREATE / EDIT DRIVER */}
        <AnimatePresence>
          {isModalOpen && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={closeModal}
              />

              {/* Modal content */}
              <motion.form
                onSubmit={handleSubmit}
                initial={{ scale: 0.96, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 10 }}
                className="relative z-10 w-full max-w-lg rounded-2xl border border-[var(--color-neutral)] bg-[var(--color-white)] p-6 shadow-2xl"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[color:var(--color-sidebar)]">
                      {isEditing ? "Edit Driver" : "Create Driver"}
                    </h2>
                    <p
                      className="mt-1 text-xs"
                      style={{ color: "var(--color-sidebar)", opacity: 0.75 }}
                    >
                      {isEditing
                        ? "Update driver details and access."
                        : "Fill in driver details to create a new account."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-full p-2 hover:bg-[var(--color-neutral)] transition"
                    aria-label="Close"
                  >
                    <span
                      className="block text-sm"
                      style={{ color: "var(--color-sidebar)" }}
                    >
                      ✕
                    </span>
                  </button>
                </div>

                {/* form alerts inside modal if needed */}
                {globalError && (
                  <div className="mb-2 rounded-lg border border-[var(--color-error)] bg-[var(--color-error)]/10 px-3 py-2 text-[11px] font-medium text-[color:var(--color-error)]">
                    {globalError}
                  </div>
                )}

                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-[color:var(--color-sidebar)]">
                      Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-neutral)] px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[color:var(--color-sidebar)]">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-neutral)] px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[color:var(--color-sidebar)]">
                      {isEditing ? "New Password (optional)" : "Password"}
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-neutral)] px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
                    />
                    <p
                      className="mt-1 text-[11px]"
                      style={{ color: "var(--color-sidebar)", opacity: 0.7 }}
                    >
                      Minimum 6 characters.{" "}
                      {isEditing &&
                        "Leave blank if you do not want to change password."}
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[color:var(--color-sidebar)]">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-neutral)] px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[color:var(--color-sidebar)]">
                      Vehicle Number
                    </label>
                    <input
                      type="text"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-neutral)] px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[color:var(--color-sidebar)]">
                      Vehicle Type{" "}
                      <span style={{ opacity: 0.7 }}>(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-neutral)] px-3 py-2 outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
                      placeholder="Tempo, Truck, Bike..."
                    />
                  </div>

                  {isEditing && (
                    <div className="md:col-span-2 flex items-center gap-2 mt-1">
                      <input
                        id="driver-active"
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="h-4 w-4 rounded border-[var(--color-neutral)]"
                      />
                      <label
                        htmlFor="driver-active"
                        className="text-xs"
                        style={{ color: "var(--color-sidebar)", opacity: 0.9 }}
                      >
                        Active driver
                      </label>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-full rounded-lg border border-[var(--color-neutral)] bg-[var(--color-white)] px-4 py-2 text-sm font-medium text-[color:var(--color-sidebar)] hover:bg-[var(--color-neutral)] transition sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-lg bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-[var(--color-white)] shadow-md transition hover:brightness-95 disabled:opacity-60 sm:w-auto"
                  >
                    {saving
                      ? isEditing
                        ? "Saving..."
                        : "Creating..."
                      : isEditing
                      ? "Save Changes"
                      : "Create Driver"}
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

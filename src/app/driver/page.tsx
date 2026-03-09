// src/app/driver/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useListBillsQuery, Bill } from "@/store/billingApi";
import { useRouter } from "next/navigation";

type DriverMe = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  vehicleNumber: string;
  vehicleType?: string;
};

export default function DriverDashboardPage() {
  const { data, isLoading, refetch } = useListBillsQuery({ search: "" });
  const bills = data?.bills ?? [];

  const [driver, setDriver] = useState<DriverMe | null>(null);
  const [driverLoading, setDriverLoading] = useState(false);
  const [driverError, setDriverError] = useState<string | null>(null);
  const router = useRouter();
  // ---- load driver info ----
  useEffect(() => {
    const loadDriver = async (): Promise<void> => {
      try {
        setDriverLoading(true);
        setDriverError(null);

        const res = await fetch("/api/driver/me", { method: "GET" });
        if (!res.ok) {
          setDriverError("Failed to load driver info");
          return;
        }

        const json = (await res.json()) as { driver: DriverMe };
        setDriver(json.driver);
      } catch {
        setDriverError("Failed to load driver info");
      } finally {
        setDriverLoading(false);
      }
    };

    void loadDriver();
  }, []);

  const isSameDay = (date: Date, today: Date): boolean => {
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  // ---- sirf aaj ke bills is driver ke ----
  const driverTodayBills = useMemo(() => {
    if (!driver) return [];
    const today = new Date();

    return bills.filter((b) => {
      if (b.driver !== driver._id) return false;
      const d = new Date(b.billDate);
      return isSameDay(d, today);
    });
  }, [bills, driver]);

  // ---- analytics (only today's orders) ----
  const {
    totalOrders,
    deliveredCount,
    partiallyPaidCount,
    pendingPaymentCount,
    totalAmount,
    totalPendingAmount,
  } = useMemo(() => {
    let total = 0;
    let pendingAmount = 0;

    let delivered = 0;
    let partiallyPaid = 0;
    let pendingPayment = 0;

    driverTodayBills.forEach((b) => {
      total += b.grandTotal;
      pendingAmount += b.balanceAmount;

      if (b.status === "DELIVERED") {
        delivered += 1;
      } else if (b.status === "PARTIALLY_PAID") {
        partiallyPaid += 1;
      }

      if (b.balanceAmount > 0) {
        pendingPayment += 1;
      }
    });

    return {
      totalOrders: driverTodayBills.length,
      deliveredCount: delivered,
      partiallyPaidCount: partiallyPaid,
      pendingPaymentCount: pendingPayment,
      totalAmount: total,
      totalPendingAmount: pendingAmount,
    };
  }, [driverTodayBills]);

  const formatDate = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatStatus = (bill: Bill): string => {
    if (bill.status === "DELIVERED") return "Delivered";
    if (bill.status === "OUT_FOR_DELIVERY") return "Out for delivery";
    if (bill.status === "PARTIALLY_PAID") return "Partially paid";
    return "Pending";
  };

  return (
    <div className="space-y-6">
      {/* TOP BAR */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--color-sidebar)]">
            Today&apos;s Overview
          </h2>
          <p className="text-xs text-slate-500">
            Today&apos;s assigned orders and payments.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          className="w-fit rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
        >
          Refresh orders
        </button>
      </div>

      {/* DRIVER INFO CARD */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-[color:var(--color-white)] p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[color:var(--color-sidebar)]">
            Driver details
          </h3>

          {driverLoading && (
            <p className="mt-2 text-xs text-slate-500">
              Loading driver info...
            </p>
          )}

          {driverError && (
            <p className="mt-2 text-xs text-red-500">
              {driverError}
            </p>
          )}

          {driver && (
            <div className="mt-3 space-y-1 text-sm">
              <p className="font-medium text-slate-800">
                {driver.name}
              </p>
              <p className="text-xs text-slate-600">
                Email: {driver.email}
              </p>
              <p className="text-xs text-slate-600">
                Phone: {driver.phone}
              </p>
              <p className="text-xs text-slate-600">
                Vehicle: {driver.vehicleNumber}{" "}
                {driver.vehicleType && (
                  <span className="text-[11px] text-slate-500">
                    ({driver.vehicleType})
                  </span>
                )}
              </p>
            </div>
          )}

          {!driverLoading && !driver && !driverError && (
            <p className="mt-2 text-xs text-slate-500">
              No driver info loaded from /api/driver/me
            </p>
          )}
        </div>

        {/* HIGH LEVEL AMOUNTS (TODAY) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[color:var(--color-white)] p-3 shadow-sm">
            <p className="text-[11px] text-slate-500">
              Today&apos;s orders assigned
            </p>
            <p className="mt-1 text-2xl font-semibold text-[color:var(--color-sidebar)]">
              {totalOrders}
            </p>
          </div>

          <div className="rounded-xl bg-[color:var(--color-white)] p-3 shadow-sm">
            <p className="text-[11px] text-slate-500">
              Today&apos;s total amount
            </p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--color-primary)]">
              ₹{totalAmount.toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Pending: ₹{totalPendingAmount.toFixed(2)}
            </p>
          </div>

          <div className="rounded-xl bg-[color:var(--color-white)] p-3 shadow-sm">
            <p className="text-[11px] text-slate-500">
              Orders with pending payment
            </p>
            <p className="mt-1 text-2xl font-semibold text-amber-600">
              {pendingPaymentCount}
            </p>
          </div>

          <div className="rounded-xl bg-[color:var(--color-white)] p-3 shadow-sm">
            <p className="text-[11px] text-slate-500">
              Partially paid orders
            </p>
            <p className="mt-1 text-2xl font-semibold text-amber-700">
              {partiallyPaidCount}
            </p>
          </div>
        </div>
      </div>

      {/* STATUS CARDS (TODAY) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-[color:var(--color-white)] p-3 shadow-sm">
          <p className="text-[11px] text-slate-500">
            Delivered today
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {deliveredCount}
          </p>
        </div>

        <div className="rounded-xl bg-[color:var(--color-white)] p-3 shadow-sm">
          <p className="text-[11px] text-slate-500">
            Pending today (not delivered)
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-700">
            {totalOrders - deliveredCount}
          </p>
        </div>
      </div>

      {/* RECENT ORDERS LIST (for driver) – only today */}
      <div className="rounded-xl bg-[color:var(--color-white)] p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[color:var(--color-sidebar)]">
            Today&apos;s assigned orders
          </h3>
          <p className="text-[11px] text-slate-500">
            Showing {driverTodayBills.length} orders
          </p>
        </div>

        {driverTodayBills.length === 0 && !isLoading && (
          <p className="text-xs text-slate-500">
            No orders assigned to you today.
          </p>
        )}

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {driverTodayBills.map((bill) => {
            const shopName = (bill.customerInfo.shopName || "").trim();
            const customerName = (bill.customerInfo.name || "").trim();
            const phone = bill.customerInfo.phone || "";
            const primaryTitle = shopName || customerName || "Customer";
            const secondaryLine = shopName
              ? `Customer: ${customerName || "-"}${phone ? ` - ${phone}` : ""}`
              : phone
                ? `Phone: ${phone}`
                : "";

            return (
              <div
                key={bill._id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {primaryTitle}
                  </p>
                  {secondaryLine && (
                    <p className="text-[11px] text-slate-600">
                      {secondaryLine}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500">
                    Invoice: {bill.invoiceNumber || "-"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatDate(bill.billDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-500">
                    Grand: ?{bill.grandTotal.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Paid: ?{bill.amountCollected.toFixed(2)} ? Bal: ?
                    {bill.balanceAmount.toFixed(2)}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      bill.status === "DELIVERED"
                        ? "bg-emerald-100 text-emerald-700"
                        : bill.status === "OUT_FOR_DELIVERY"
                        ? "bg-blue-100 text-blue-700"
                        : bill.status === "PARTIALLY_PAID"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {formatStatus(bill)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-2 text-[11px] text-slate-500">
          For full history, open{" "}
          <button className="font-semibold" onClick={ () => router.push('/driver/orders') }>My Orders</button> page.
        </p>
      </div>
    </div>
  );
}

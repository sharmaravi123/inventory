// src/app/warehouse/components/orders/WarehouseOrdersPage.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  useListBillsQuery,
  useAssignBillDriverMutation,
  useMarkBillDeliveredMutation,
  Bill,
} from "@/store/billingApi";
import BillList from "@/app/admin/components/billing/BillList";
import BillPreview from "@/app/admin/components/billing/BillPreview";
import EditPaymentModal from "@/app/admin/components/billing/EditPaymentModal";
import { useDispatch, useSelector } from "react-redux";
import { fetchDrivers } from "@/store/driverSlice";
import type { RootState, AppDispatch } from "@/store/store";

type StatusFilter = "ALL" | "PENDING" | "PARTIALLY_PAID" | "PAID";

type WarehouseOrdersPageProps = {
  // undefined => no restriction (admin)
  // string[] => sirf in warehouses ke orders
  allowedWarehouseIds?: string[];
};

function extractId(ref: unknown): string | undefined {
  if (ref == null) return undefined;
  if (typeof ref === "string" || typeof ref === "number") return String(ref);
  if (typeof ref === "object") {
    const obj = ref as Record<string, unknown>;
    const candidate = obj._id ?? obj.id;
    if (candidate == null || candidate === "") return undefined;
    return String(candidate);
    }
  return undefined;
}

function getBillWarehouseId(bill: Bill): string | undefined {
  const withWarehouse = bill as unknown as {
    warehouseId?: unknown;
    warehouse?: unknown;
  };

  const direct = withWarehouse.warehouseId;
  const fromObj = withWarehouse.warehouse;

  return extractId(direct ?? fromObj);
}

export default function WarehouseOrdersPage({
  allowedWarehouseIds,
}: WarehouseOrdersPageProps) {
  const { data, isLoading, refetch } = useListBillsQuery({ search: "" });
  const bills = data?.bills ?? [];

  const dispatch = useDispatch<AppDispatch>();
  const drivers = useSelector((s: RootState) => s.driver.items);

  const [assignBillDriver] = useAssignBillDriverMutation();
  const [markBillDelivered] = useMarkBillDeliveredMutation();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedBill, setSelectedBill] = useState<Bill | undefined>();
  const [paymentBill, setPaymentBill] = useState<Bill | undefined>();

  useEffect(() => {
    void dispatch(fetchDrivers());
  }, [dispatch]);

  const limitByWarehouse =
    Array.isArray(allowedWarehouseIds) && allowedWarehouseIds.length > 0;

  // ---------- BILL LIST LIMITED BY WAREHOUSE ----------
  const warehouseBills = useMemo(() => {
    if (!limitByWarehouse) return bills;

    // Check: kya data me warehouseId/warehouse aa hi raha hai?
    const anyHasWarehouse = bills.some((b) => !!getBillWarehouseId(b));
    if (!anyHasWarehouse) {
      // Agar kisi bhi bill me warehouse info nahi hai,
      // to filter nahi lagayenge, sab dikha denge (warna sab 0 ho jate).
      return bills;
    }

    return bills.filter((bill) => {
      const wid = getBillWarehouseId(bill);
      if (!wid) return false;
      return allowedWarehouseIds.includes(wid);
    });
  }, [bills, allowedWarehouseIds, limitByWarehouse]);

  // ---------- FILTERED LIST (search + date + status) ----------
  const filteredBills = useMemo(() => {
    return warehouseBills.filter((bill) => {
      const text = [
        bill.invoiceNumber,
        bill.customerInfo.name,
        bill.customerInfo.phone,
        bill.customerInfo.shopName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      if (search.trim() && !text.includes(search.toLowerCase())) {
        return false;
      }

      if (fromDate) {
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);
        const d = new Date(bill.billDate);
        if (d < from) return false;
      }

      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        const d = new Date(bill.billDate);
        if (d > to) return false;
      }

      if (statusFilter !== "ALL") {
        if (statusFilter === "PAID") {
          if (bill.balanceAmount !== 0) return false;
        } else if (statusFilter === "PARTIALLY_PAID") {
          if (bill.status !== "PARTIALLY_PAID") return false;
        } else if (statusFilter === "PENDING") {
          if (!(bill.balanceAmount > 0 && bill.status !== "DELIVERED")) {
            return false;
          }
        }
      }

      return true;
    });
  }, [warehouseBills, search, fromDate, toDate, statusFilter]);

  // ---------- ANALYTICS (based on filteredBills) ----------
  const {
    totalOrders,
    thisMonthOrders,
    thisYearOrders,
    totalAmount,
    totalPendingAmount,
    todayOrders,
    todayAmount,
  } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    let total = 0;
    let monthCount = 0;
    let yearCount = 0;
    let pendingAmount = 0;
    let todayCount = 0;
    let todayTotal = 0;

    filteredBills.forEach((b) => {
      total += b.grandTotal;

      const d = new Date(b.billDate);
      const y = d.getFullYear();
      const m = d.getMonth();
      const day = d.getDate();

      if (m === currentMonth && y === currentYear) {
        monthCount += 1;
      }

      if (y === currentYear) {
        yearCount += 1;
      }

      if (b.balanceAmount > 0) {
        pendingAmount += b.balanceAmount;
      }

      if (y === currentYear && m === currentMonth && day === currentDay) {
        todayCount += 1;
        todayTotal += b.grandTotal;
      }
    });

    return {
      totalOrders: filteredBills.length,
      thisMonthOrders: monthCount,
      thisYearOrders: yearCount,
      totalAmount: total,
      totalPendingAmount: pendingAmount,
      todayOrders: todayCount,
      todayAmount: todayTotal,
    };
  }, [filteredBills]);

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setFromDate("");
    setToDate("");
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[color:var(--color-sidebar)]">
            Warehouse Orders
          </h1>
          <p className="text-xs text-slate-500">
            Orders and payment status for your assigned warehouse(s) only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)] sm:mt-0"
        >
          Refresh
        </button>
      </div>

      {/* ANALYTICS CARDS */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl bg-[color:var(--color-white)] p-3 shadow-sm">
          <p className="text-[11px] text-slate-500">Total Orders</p>
          <p className="mt-1 text-2xl font-semibold text-[color:var(--color-sidebar)]">
            {totalOrders}
          </p>
        </div>

        <div className="rounded-xl bg-[color:var(--color-white)] p-3 shadow-sm">
          <p className="text-[11px] text-slate-500">Today Orders</p>
          <p className="mt-1 text-2xl font-semibold text-[color:var(--color-sidebar)]">
            {todayOrders}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Today Amount: ₹{todayAmount.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl bg-[color:var(--color-white)] p-3 shadow-sm">
          <p className="text-[11px] text-slate-500">This Month</p>
          <p className="mt-1 text-2xl font-semibold text-[color:var(--color-sidebar)]">
            {thisMonthOrders}
          </p>
        </div>

        <div className="rounded-xl bg-[color:var(--color-white)] p-3 shadow-sm">
          <p className="text-[11px] text-slate-500">This Year</p>
          <p className="mt-1 text-2xl font-semibold text-[color:var(--color-sidebar)]">
            {thisYearOrders}
          </p>
        </div>

        <div className="rounded-xl bg-[color:var(--color-white)] p-3 shadow-sm">
          <p className="text-[11px] text-slate-500">Total Amount</p>
          <p className="mt-1 text-lg font-semibold text-[color:var(--color-primary)]">
            ₹{totalAmount.toFixed(2)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Pending: ₹{totalPendingAmount.toFixed(2)}
          </p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="rounded-xl bg-[color:var(--color-white)] p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4 md:items-end">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              Search
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              placeholder="Invoice / customer / phone / shop"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              Payment Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as StatusFilter)
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-500">
            Showing {filteredBills.length} of {warehouseBills.length} orders
          </span>
          <button
            type="button"
            onClick={handleResetFilters}
            className="rounded-full border border-slate-300 px-3 py-1 hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
          >
            Reset filters
          </button>
        </div>
      </div>

      {/* LIST */}
      <BillList
        bills={filteredBills}
        loading={isLoading}
        onSelectBill={(bill) => setSelectedBill(bill)}
        onEditPayment={(bill) => setPaymentBill(bill)}
        onEditOrder={(bill) => setSelectedBill(bill)}
        drivers={drivers}
        onAssignDriver={async (bill, driverId) => {
          await assignBillDriver({ billId: bill._id, driverId }).unwrap();
          void refetch();
        }}
        onMarkDelivered={async (bill) => {
          await markBillDelivered({ billId: bill._id }).unwrap();
          void refetch();
        }}
      />

      {/* PREVIEW */}
      {selectedBill && (
        <BillPreview
          bill={selectedBill}
          onClose={() => setSelectedBill(undefined)}
        />
      )}

      {/* EDIT PAYMENT */}
      {paymentBill && (
        <EditPaymentModal
          bill={paymentBill}
          onClose={() => setPaymentBill(undefined)}
          onUpdated={() => {
            setPaymentBill(undefined);
            refetch();
          }}
        />
      )}
    </div>
  );
}

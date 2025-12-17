"use client";

import React from "react";
import { Bill } from "@/store/billingApi";
import { Driver } from "@/store/driverSlice";

type BillListProps = {
  bills: Bill[];
  loading: boolean;
  onSelectBill: (bill: Bill) => void;
  onEditPayment: (bill: Bill) => void;
  onEditOrder: (bill: Bill) => void;

  // optional – admin view ke liye
  drivers?: Driver[];
  onAssignDriver?: (bill: Bill, driverId: string | null) => void;
  onMarkDelivered?: (bill: Bill) => void;
  hideEditOrderButton?: boolean;
};

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function formatCsvValue(value: string | number | null | undefined): string {
  const str =
    value === null || value === undefined
      ? ""
      : typeof value === "number"
      ? value.toString()
      : value;
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

function getCsvFileName(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `orders-list-${yyyy}-${mm}-${dd}.csv`;
}

function getDriverNameForBill(bill: Bill, drivers?: Driver[]): string {
  if (drivers && bill.driver) {
    const found = drivers.find((d) => d._id === bill.driver);
    if (found) return found.name;
  }
  if (bill.driver) return "Assigned";
  return "Unassigned";
}

export default function BillList({
  bills,
  loading,
  onSelectBill,
  onEditPayment,
  onEditOrder,
  drivers,
  onAssignDriver,
  onMarkDelivered,
  hideEditOrderButton,
}: BillListProps) {
  const handleExport = () => {
    if (bills.length === 0) return;

    const header = [
      "Invoice Number",
      "Bill Date",
      "Customer Name",
      "Shop Name",
      "Phone",
      "Grand Total",
      "Amount Collected",
      "Balance Amount",
      "Order Status",
      "Payment Status",
      "Driver",
    ];

    const rows: string[] = [];
    rows.push(header.map((h) => formatCsvValue(h)).join(","));

    bills.forEach((bill) => {
      const billDateObj = new Date(bill.billDate);
      const billDate = billDateObj.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      const balance = bill.balanceAmount;
      const paymentStatusLabel =
        balance <= 0
          ? "Paid"
          : bill.status === "PARTIALLY_PAID"
          ? "Partially Paid"
          : "Pending";

      const driverName = getDriverNameForBill(bill, drivers);

      const line = [
        formatCsvValue(bill.invoiceNumber ?? ""),
        formatCsvValue(billDate),
        formatCsvValue(bill.customerInfo.name ?? ""),
        formatCsvValue(bill.customerInfo.shopName ?? ""),
        formatCsvValue(bill.customerInfo.phone ?? ""),
        formatCsvValue(bill.grandTotal.toFixed(2)),
        formatCsvValue(bill.amountCollected.toFixed(2)),
        formatCsvValue(balance.toFixed(2)),
        formatCsvValue(bill.status),
        formatCsvValue(paymentStatusLabel),
        formatCsvValue(driverName),
      ].join(",");

      rows.push(line);
    });

    const csvContent = `\uFEFF${rows.join("\r\n")}`;
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = getCsvFileName();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl bg-[color:var(--color-white)] p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[color:var(--color-sidebar)]">
          Orders
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {loading ? "Loading..." : `${bills.length} records`}
          </span>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-full border border-slate-300 px-3 py-1 text-[11px] text-slate-700 hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
          >
            Export CSV
          </button>
        </div>
      </div>

      {bills.length === 0 && !loading && (
        <p className="text-sm text-slate-500">No orders found.</p>
      )}

      <div className="max-h-[480px] space-y-2 overflow-y-auto">
        {bills.map((bill) => {
          const paid = bill.amountCollected;
          const balance = bill.balanceAmount;

          const statusLabel =
            bill.status === "DELIVERED"
              ? "Delivered"
              : bill.status === "OUT_FOR_DELIVERY"
              ? "Out for delivery"
              : bill.status === "PARTIALLY_PAID"
              ? "Partially Paid"
              : "Pending";

          const paymentStatusLabel =
            balance <= 0
              ? "Paid"
              : bill.status === "PARTIALLY_PAID"
              ? "Partially Paid"
              : "Pending";

          const paymentBadgeClass =
            balance <= 0
              ? "bg-emerald-100 text-emerald-700"
              : bill.status === "PARTIALLY_PAID"
              ? "bg-amber-100 text-amber-700"
              : "bg-rose-100 text-rose-700";

          const driverName = getDriverNameForBill(bill, drivers);

          return (
            <div
              key={bill._id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectBill(bill)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onSelectBill(bill);
                }
              }}
              className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)]/5 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {bill.invoiceNumber}
                  </p>
                  <p className="text-xs text-slate-600">
                    {bill.customerInfo.name} • {bill.customerInfo.phone}
                  </p>
                  {bill.customerInfo.shopName && (
                    <p className="text-[11px] text-slate-500">
                      {bill.customerInfo.shopName}
                    </p>
                  )}

                  {/* Driver assignment (admin) */}
                  {drivers && onAssignDriver && (
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
                      <span className="text-slate-500">Driver:</span>
                      <select
                        value={bill.driver ?? ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          onAssignDriver(
                            bill,
                            e.target.value === "" ? null : e.target.value
                          )
                        }
                        className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] focus:ring-[var(--color-primary)] focus:outline-none"
                      >
                        <option value="">Unassigned</option>

                        {drivers.map((d) => {
                          const label = `${d.name} (${d.phone}) - ${(d.vehicleNumber || "").toUpperCase()}`;
                          return (
                            <option key={d._id} value={d._id}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* Driver info (driver/simple view) */}
                  {!drivers && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Driver: {driverName}
                    </p>
                  )}
                </div>

                <div className="text-right text-xs">
                  <p className="font-semibold">
                    ₹{bill.grandTotal.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Paid: ₹{paid.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Bal: ₹{balance.toFixed(2)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {formatDate(bill.billDate)}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      bill.status === "DELIVERED"
                        ? "bg-emerald-100 text-emerald-700"
                        : bill.status === "OUT_FOR_DELIVERY"
                        ? "bg-sky-100 text-sky-700"
                        : bill.status === "PARTIALLY_PAID"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {statusLabel}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${paymentBadgeClass}`}
                  >
                    Payment: {paymentStatusLabel}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {/* Mark Delivered */}
                  {onMarkDelivered && bill.status !== "DELIVERED" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkDelivered(bill);
                      }}
                      className="rounded-full border border-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-600 hover:text-white"
                    >
                      Mark Delivered
                    </button>
                  )}

                  {/* Edit Order */}
                  {!hideEditOrderButton && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditOrder(bill);
                      }}
                      className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] text-slate-700 hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
                    >
                      Edit Order
                    </button>
                  )}

                  {/* Edit Payment */}
                  {/* <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditPayment(bill);
                    }}
                    className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] text-slate-700 hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
                  >
                    Edit Payment
                  </button> */}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

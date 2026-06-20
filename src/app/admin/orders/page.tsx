"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  useListBillsQuery,
  useAssignBillDriverMutation,
  useMarkBillDeliveredMutation,
  useDeleteBillMutation,
  Bill,
} from "@/store/billingApi";
import BillList from "@/app/admin/components/billing/BillList";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/store/store";
import { fetchDrivers } from "@/store/driverSlice";
import { fetchInventory } from "@/store/inventorySlice";
import { Search, Calendar } from "lucide-react";
import Swal from "sweetalert2";
import { fetchCompanyProfile } from "@/store/companyProfileSlice";
import { formatDisplayDate } from "@/lib/dateFormat";

const BillPreview = dynamic(
  () => import("@/app/admin/components/billing/BillPreview"),
  { ssr: false }
);
const EditPaymentModal = dynamic(
  () => import("@/app/admin/components/billing/EditPaymentModal"),
  { ssr: false }
);

/* ================= TYPES ================= */

type DateFilter = "all" | "thisMonth" | "lastMonth" | "custom";

const toNum = (v: unknown, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

export default function OrdersPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { data, isLoading, refetch } = useListBillsQuery({ search: "" });
  const bills = data?.bills ?? [];

  const drivers = useSelector((s: RootState) => s.driver.items);

  const [assignBillDriver] = useAssignBillDriverMutation();
  const [markBillDelivered] = useMarkBillDeliveredMutation();
  const [deleteBill] = useDeleteBillMutation();

  const [filterType, setFilterType] = useState<DateFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");

  const [selectedBill, setSelectedBill] = useState<Bill>();
  const [paymentBill, setPaymentBill] = useState<Bill>();
  const companyProfile = useSelector(
    (state: RootState) => state.companyProfile.data
  );
  useEffect(() => {
    dispatch(fetchCompanyProfile());
  }, [dispatch]);
  useEffect(() => {
    dispatch(fetchDrivers());
  }, [dispatch]);

  /* ================= DATE FILTER ================= */

  const matchDate = useCallback(
    (billDate: string) => {
      const d = new Date(billDate);
      const now = new Date();

      if (filterType === "all") return true;

      if (filterType === "thisMonth") {
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      }

      if (filterType === "lastMonth") {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
      }

      if (filterType === "custom" && fromDate && toDate) {
        const f = new Date(fromDate);
        const t = new Date(toDate);
        f.setHours(0, 0, 0, 0);
        t.setHours(23, 59, 59, 999);
        return d >= f && d <= t;
      }

      return true;
    },
    [filterType, fromDate, toDate]
  );

    /* ================= FILTERED BILLS ================= */

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      const text = `${b.invoiceNumber} ${b.customerInfo.name} ${b.items
        .map((i) => i.productName)
        .join(" ")}`.toLowerCase();

      if (search && !text.includes(search.toLowerCase())) return false;
      if (!matchDate(b.billDate)) return false;
      return true;
    });
  }, [bills, search, matchDate]);

  /* ================= STATS ================= */

  const stats = useMemo(() => {
    let taxable = 0,
      cgst = 0,
      sgst = 0,
      total = 0;

    filteredBills.forEach((b) => {
      taxable += b.totalBeforeTax ?? 0;
      total += b.grandTotal ?? 0;
      const half = (b.totalTax ?? 0) / 2;
      cgst += half;
      sgst += half;
    });

    return {
      invoices: filteredBills.length,
      taxable,
      cgst,
      sgst,
      igst: 0,
      gst: cgst + sgst,
      total,
    };
  }, [filteredBills]);

  /* ================= GST EXCEL ================= */

  const exportGstExcel = async () => {
    if (!filteredBills.length) {
      Swal.fire({
        icon: "warning",
        title: "Error",
        text: "No daya to export",
        timer: 2000,
        showConfirmButton: true,
      });

      return;
    }

    const getMonthRangeLabel = (value: Date) => {
      const start = new Date(value.getFullYear(), value.getMonth(), 1);
      const end = new Date(value.getFullYear(), value.getMonth() + 1, 0);
      return `${formatDisplayDate(start)} to ${formatDisplayDate(end)}`;
    };

    const reportPeriod =
      filterType === "custom" && fromDate && toDate
        ? `${formatDisplayDate(fromDate)} to ${formatDisplayDate(toDate)}`
        : filterType === "thisMonth"
          ? getMonthRangeLabel(new Date())
          : filterType === "lastMonth"
            ? getMonthRangeLabel(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1))
            : "All Time";

    const companyState = (companyProfile?.gstin || "").slice(0, 2);

    const salesRows = filteredBills.map((bill) => {
      const customerGstin = bill.customerInfo.gstNumber || "";
      const customerState = customerGstin.slice(0, 2);
      const isIntraState =
        companyState && customerState
          ? companyState === customerState
          : true;

      const totalTax = Number(bill.totalTax ?? 0);
      const grossTotal = Number(bill.grandTotal ?? 0);
      const salesAmount = Number(bill.totalBeforeTax ?? 0);

      const cgst = isIntraState ? totalTax / 2 : 0;
      const sgst = isIntraState ? totalTax / 2 : 0;
      const igst = isIntraState ? 0 : totalTax;

      const roundValue =
        typeof bill.roundOff === "number"
          ? bill.roundOff
          : grossTotal - (salesAmount + cgst + sgst + igst);

      const uniqueRates = Array.from(
        new Set(
          bill.items
            .map((item) => Number(item.taxPercent ?? 0))
            .filter((rate) => Number.isFinite(rate))
            .map((rate) => rate.toFixed(2).replace(/\.00$/, ""))
        )
      );

      const cashAmt = toNum(bill.payment?.cashAmount);
      const upiAmt = toNum(bill.payment?.upiAmount);
      const cardAmt = toNum(bill.payment?.cardAmount);

      return {
        Date: formatDisplayDate(bill.billDate),
        Particulars: bill.customerInfo.shopName || bill.customerInfo.name || "",
        "Voucher Type": "Sales",
        "Voucher No.": bill.invoiceNumber || "",
        "Voucher Ref. No.": "",
        "GSTIN/UIN": customerGstin,
        "Gross Total": grossTotal.toFixed(2),
        "Tax Rate": uniqueRates.join(", "),
        Sales: salesAmount.toFixed(2),
        "CGST OUTPUT @ 2.5% SALES": cgst.toFixed(2),
        "SGST OUTPUT @ 2.5% SALES": sgst.toFixed(2),
        Round: roundValue.toFixed(2),
        "GST 5%": igst.toFixed(2),
        "Cash (₹)": cashAmt.toFixed(2),
        "UPI (₹)": upiAmt.toFixed(2),
        "Card (₹)": cardAmt.toFixed(2),
      };
    });

    const parseAmt = (v: unknown) => {
      const n = parseFloat(String(v ?? "0").replace(/,/g, ""));
      return Number.isFinite(n) ? n : 0;
    };

    const sumCol = (rows: Record<string, string>[], key: string) =>
      rows.reduce((a, r) => a + parseAmt(r[key]), 0);

    const footerSales =
      salesRows.length > 0
        ? {
            Date: "",
            Particulars: "TOTAL",
            "Voucher Type": "",
            "Voucher No.": "",
            "Voucher Ref. No.": "",
            "GSTIN/UIN": "",
            "Gross Total": sumCol(salesRows, "Gross Total").toFixed(2),
            "Tax Rate": "",
            Sales: sumCol(salesRows, "Sales").toFixed(2),
            "CGST OUTPUT @ 2.5% SALES": sumCol(
              salesRows,
              "CGST OUTPUT @ 2.5% SALES"
            ).toFixed(2),
            "SGST OUTPUT @ 2.5% SALES": sumCol(
              salesRows,
              "SGST OUTPUT @ 2.5% SALES"
            ).toFixed(2),
            Round: sumCol(salesRows, "Round").toFixed(2),
            "GST 5%": sumCol(salesRows, "GST 5%").toFixed(2),
            "Cash (₹)": sumCol(salesRows, "Cash (₹)").toFixed(2),
            "UPI (₹)": sumCol(salesRows, "UPI (₹)").toFixed(2),
            "Card (₹)": sumCol(salesRows, "Card (₹)").toFixed(2),
          }
        : null;

    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet([]);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.sheet_add_aoa(
      worksheet,
      [
        [companyProfile?.name || ""],
        [companyProfile?.addressLine1 || ""],
        [companyProfile?.addressLine2 || ""],
        [`M-${companyProfile?.phone || ""}`],
        [`Contact : ${companyProfile?.phone || ""}`],
        [`GSTIN : ${companyProfile?.gstin || ""}`],
        [`Date : ${reportPeriod}`],
        [],
        ["Sales Register"],
        [],
      ],
      { origin: "A1" }
    );

    XLSX.utils.sheet_add_json(worksheet, footerSales ? [...salesRows, footerSales] : salesRows, {
      skipHeader: false,
      origin: "A11",
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Register");
    XLSX.writeFile(workbook, "Sales-Register.xlsx");
  };


  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* FILTER BAR */}
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by customer or product..."
                className="w-full rounded-xl border pl-9 pr-3 py-2"
              />
            </div>

            <div className="flex gap-2">
              {[
                ["all", "All time"],
                ["thisMonth", "This month"],
                ["lastMonth", "Last month"],
                ["custom", "Custom"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setFilterType(v as DateFilter)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold ${filterType === v
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100"
                    }`}
                >
                  <Calendar className="inline h-3 w-3 mr-1" />
                  {l}
                </button>
              ))}
            </div>
          </div>

          {filterType === "custom" && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-xl border px-3 py-2" />
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-xl border px-3 py-2" />
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button onClick={exportGstExcel} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs text-white">
              Export GST Excel
            </button>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Showing {filteredBills.length} orders
          </p>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="rounded-xl bg-white p-4">Invoices<br /><b>{stats.invoices}</b></div>
          <div className="rounded-xl bg-white p-4">Taxable<br />₹{stats.taxable.toFixed(2)}</div>
          <div className="rounded-xl bg-white p-4">Total GST<br />₹{stats.gst.toFixed(2)}</div>
          <div className="rounded-xl bg-white p-4">Total Sales<br />₹{stats.total.toFixed(2)}</div>
        </div>

        {/* LIST */}
        <BillList
          bills={filteredBills}
          loading={isLoading && bills.length === 0}
          drivers={drivers}
          onSelectBill={setSelectedBill}
          onEditPayment={setPaymentBill}
          onEditOrder={setSelectedBill}
          onDeleteBill={async (bill) => {
            const confirm = await Swal.fire({
              title: "Delete this bill?",
              text: `Invoice ${bill.invoiceNumber ?? ""} will be removed and stock will be restored.`,
              icon: "warning",
              showCancelButton: true,
              confirmButtonColor: "#dc2626",
              confirmButtonText: "Delete",
              cancelButtonText: "Cancel",
            });
            if (!confirm.isConfirmed) return;
            try {
              await deleteBill(bill._id).unwrap();
              await Swal.fire({
                icon: "success",
                title: "Deleted successfully",
                timer: 1800,
                showConfirmButton: false,
              });
              void dispatch(fetchInventory({ force: true }));
              refetch();
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : "Delete failed";
              Swal.fire({ icon: "error", title: "Error", text: msg });
            }
          }}
          onAssignDriver={async (bill, driverId) => {
            if (!driverId) return;
            await assignBillDriver({ billId: bill._id, driverId }).unwrap();
            refetch();
          }}
          onMarkDelivered={async (bill) => {
            await markBillDelivered({ billId: bill._id }).unwrap();
            refetch();
          }}
        />

        {selectedBill && (
          <BillPreview onClose={() => setSelectedBill(undefined)} />
        )}

        {paymentBill && (
          <EditPaymentModal bill={paymentBill} onClose={() => setPaymentBill(undefined)} onUpdated={refetch} />
        )}
      </div>
    </div>
  );
}


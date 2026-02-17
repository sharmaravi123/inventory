"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import * as XLSX from "xlsx";
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
import type { RootState, AppDispatch } from "@/store/store";
import { fetchDrivers } from "@/store/driverSlice";
import { Search, Calendar } from "lucide-react";
import Swal from "sweetalert2";
import { fetchCompanyProfile } from "@/store/companyProfileSlice";

/* ================= TYPES ================= */

type DateFilter = "all" | "thisMonth" | "lastMonth" | "custom";

export default function OrdersPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { data, isLoading, refetch } = useListBillsQuery(
    { search: "" },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );
  const bills = data?.bills ?? [];

  const drivers = useSelector((s: RootState) => s.driver.items);

  const [assignBillDriver] = useAssignBillDriverMutation();
  const [markBillDelivered] = useMarkBillDeliveredMutation();

  const [filterType, setFilterType] = useState<DateFilter>("thisMonth");
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

  const exportGstExcel = () => {
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

    const formatDateShort = (dt: Date): string => {
      const day = String(dt.getDate()).padStart(2, "0");
      const month = dt.toLocaleString("en-IN", { month: "short" });
      const year = String(dt.getFullYear()).slice(-2);
      return `${day}-${month}-${year}`;
    };

    const reportPeriod =
      filterType === "custom" && fromDate && toDate
        ? `${formatDateShort(new Date(fromDate))} to ${formatDateShort(new Date(toDate))}`
        : filterType === "thisMonth"
          ? "This Month"
          : filterType === "lastMonth"
            ? "Last Month"
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

      const roundValue = grossTotal - (salesAmount + cgst + sgst + igst);

      const uniqueRates = Array.from(
        new Set(
          bill.items
            .map((item) => Number(item.taxPercent ?? 0))
            .filter((rate) => Number.isFinite(rate))
            .map((rate) => rate.toFixed(2).replace(/\.00$/, ""))
        )
      );

      return {
        Date: formatDateShort(new Date(bill.billDate)),
        Particulars: bill.customerInfo.shopName || bill.customerInfo.name || "",
        "Voucher Type": "Sales",
        "Voucher No.": bill.invoiceNumber || "",
        "Voucher Ref. No.": "",
        "GSTIN/UIN": customerGstin,
        "Gross Total": grossTotal.toFixed(2),
        "Tax Rate": uniqueRates.join(", "),
        Sales: salesAmount.toFixed(2),
        "CGST OUTPUT @ 9% SALES": cgst.toFixed(2),
        "SGST OUTPUT @ 9% SALES": sgst.toFixed(2),
        Round: roundValue.toFixed(2),
        "IGST-OUTPUT@18% SALE": igst.toFixed(2),
        "CGST INPUT@ 9% PUR": "0.00",
      };
    });

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

    XLSX.utils.sheet_add_json(worksheet, salesRows, {
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
          loading={isLoading}
          drivers={drivers}
          onSelectBill={setSelectedBill}
          onEditPayment={setPaymentBill}
          onEditOrder={setSelectedBill}
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


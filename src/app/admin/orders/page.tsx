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
import { fetchProducts, ProductType } from "@/store/productSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

/* ================= TYPES ================= */

type DateFilter = "all" | "thisMonth" | "lastMonth" | "custom";

export default function OrdersPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { data, isLoading, refetch } = useListBillsQuery({ search: "" });
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

  function extractProductId(
    product: string | { _id?: string } | undefined
  ): string | undefined {
    if (!product) return undefined;

    if (typeof product === "string") return product;

    if (typeof product === "object" && product._id) {
      return product._id;
    }

    return undefined;
  }
  /* 🔹 PRODUCTS — MUST BE FIRST */
  const products = useAppSelector(
    (state) => state.product.products as ProductType[]
  );
  useEffect(() => {
  if (products.length === 0) {
    dispatch(fetchProducts());
  }
}, [products.length, dispatch]);
  /* 🔹 HSN RESOLVER */
  const getHsnCode = (
    product: string | { _id?: string } | undefined
  ): string => {
    const productId = extractProductId(product);
    if (!productId) return "-";

    const found = products.find(
      (p) => p._id === productId || p.id === productId
    );

    return found?.hsnCode ?? "-";
  };
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
      igst = 0,
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
      igst,
      gst: cgst + sgst + igst,
      total,
    };
  }, [filteredBills]);

  /* ================= GST EXCEL ================= */

  const exportGstExcel = () => {
    if (!filteredBills.length) {
      alert("No data to export");
      return;
    }

    /* ================= REPORT INFO ================= */

    const reportInfo = [
      {
        Field: "Business Name",
        Value: "BlackOS Software Solution",
      },
      {
        Field: "GSTIN",
        Value: "23XXXXXXXXX1Z5",
      },
      {
        Field: "Report Period",
        Value:
          filterType === "custom"
            ? `${fromDate} to ${toDate}`
            : filterType === "thisMonth"
              ? "This Month"
              : filterType === "lastMonth"
                ? "Last Month"
                : "All Time",
      },
      {
        Field: "State & Place of Supply",
        Value: "Madhya Pradesh (23)",
      },
    ];

    /* ================= SALES ROWS ================= */

    const salesRows: any[] = [];

    let totalTaxable = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let totalGST = 0;
    let totalSales = 0;

    filteredBills.forEach((bill) => {
      const invoiceTaxable = bill.totalBeforeTax ?? 0;
      const invoiceGST = bill.totalTax ?? 0;
      const invoiceTotal = bill.grandTotal ?? 0;

      const cgst = invoiceGST / 2;
      const sgst = invoiceGST / 2;

      totalTaxable += invoiceTaxable;
      totalCGST += cgst;
      totalSGST += sgst;
      totalGST += invoiceGST;
      totalSales += invoiceTotal;

      bill.items.forEach((item) => {
        const qty =
          (item.quantityBoxes ?? 0) * (item.itemsPerBox ?? 1) +
          (item.quantityLoose ?? 0);

        const taxableValue =
          qty * (item.sellingPrice ?? 0);

        salesRows.push({
          Invoice_No: bill.invoiceNumber,
          Invoice_Date: new Date(bill.billDate).toLocaleDateString("en-IN"),
          Customer_Name: bill.customerInfo.name,
          Customer_GSTIN: bill.customerInfo.gstNumber ?? "",
          Invoice_Type: bill.customerInfo.gstNumber ? "B2B" : "B2C",
          Place_of_Supply: "23",
          Product_Name: item.productName,
          HSN: getHsnCode(item.product),
          Quantity: qty,
          Rate: item.sellingPrice ?? 0,
          Taxable_Value: taxableValue.toFixed(2),
          CGST_Amount: (cgst / bill.items.length).toFixed(2),
          SGST_Amount: (sgst / bill.items.length).toFixed(2),
          IGST_Amount: "0.00",
          Total_GST: (invoiceGST / bill.items.length).toFixed(2),
          Invoice_Total: invoiceTotal.toFixed(2),
        });
      });
    });

    /* ================= SUMMARY ================= */

    const summary = [
      { Metric: "Total Invoices", Value: filteredBills.length },
      { Metric: "Total Taxable Sales", Value: totalTaxable.toFixed(2) },
      { Metric: "Total CGST", Value: totalCGST.toFixed(2) },
      { Metric: "Total SGST", Value: totalSGST.toFixed(2) },
      { Metric: "Total IGST", Value: totalIGST.toFixed(2) },
      { Metric: "Total GST", Value: totalGST.toFixed(2) },
      { Metric: "Total Sales Value", Value: totalSales.toFixed(2) },
    ];

    /* ================= EXCEL BUILD ================= */

    const wb = XLSX.utils.book_new();

    const infoSheet = XLSX.utils.json_to_sheet(reportInfo);
    const salesSheet = XLSX.utils.json_to_sheet(salesRows);
    const summarySheet = XLSX.utils.json_to_sheet(summary);

    XLSX.utils.book_append_sheet(wb, infoSheet, "Report Info");
    XLSX.utils.book_append_sheet(wb, salesSheet, "GST Sales");
    XLSX.utils.book_append_sheet(wb, summarySheet, "GST Summary");

    XLSX.writeFile(wb, "GST_Sales_Report_MP.xlsx");
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
          <BillPreview  onClose={() => setSelectedBill(undefined)} />
        )}

        {paymentBill && (
          <EditPaymentModal bill={paymentBill} onClose={() => setPaymentBill(undefined)} onUpdated={refetch} />
        )}
      </div>
    </div>
  );
}

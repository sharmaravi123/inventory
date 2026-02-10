"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Search, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import Swal from "sweetalert2";
import type { RootState, AppDispatch } from "@/store/store";
import Select from "react-select";
import { createDealer, fetchDealers } from "@/store/dealerSlice";
import { fetchProducts } from "@/store/productSlice";
import { fetchWarehouses } from "@/store/warehouseSlice";
import {
    fetchPurchases,
    createPurchase,
    updatePurchase,
} from "@/store/purchaseSlice";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

type PurchaseItem = {
    productId: string;
    boxes: number;
    looseItems: number;
    purchasePrice: number;
    taxPercent: number;
};

type DateFilter = "all" | "thisMonth" | "lastMonth" | "custom";

export default function AdminPurchaseManager() {
    const dispatch = useDispatch<AppDispatch>();

    const dealers = useSelector(
        (s: RootState) => s.dealer?.list ?? []
    );

    const products = useSelector(
        (s: RootState) => s.product?.products ?? []
    );

    const warehouses = useSelector(
        (s: RootState) => s.warehouse?.list ?? []
    );
    

    const purchases = useSelector(
        (s: RootState) => s.purchase?.list ?? []
    );


    const [dealerId, setDealerId] = useState<string>("");
    const [warehouseId, setWarehouseId] = useState<string>("");
    const [items, setItems] = useState<PurchaseItem[]>([]);
    const [open, setOpen] = useState<boolean>(false);
    const [purchaseDate, setPurchaseDate] = useState<string>("");
    const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

    const [filterType, setFilterType] = useState<DateFilter>("thisMonth");
    const [fromDate, setFromDate] = useState<string>("");
    const [toDate, setToDate] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [openDealer, setOpenDealer] = useState(false);
    const [dealerForm, setDealerForm] = useState({
        name: "",
        phone: "",
        address: "",
        gstin: "",
    });
    useEffect(() => {
  console.log("Redux purchases:", purchases);
}, [purchases]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                await Promise.all([
                    dispatch(fetchDealers()).unwrap(),
                    dispatch(fetchProducts()).unwrap(),
                    dispatch(fetchWarehouses()).unwrap(),
                    dispatch(fetchPurchases()).unwrap(),
                ]);
            } catch (error) {
                console.error(error);
                Swal.fire("Error", "Failed to load data", "error");
            }
        };

        fetchData();
    }, []);


    useEffect(() => {
        if (open && items.length === 0) {
            setItems([
                { productId: "", boxes: 0, looseItems: 0, purchasePrice: 0, taxPercent: 0 }
            ]);
        }
    }, [open]);

    const currency = useMemo(
        () => new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }),
        []
    );

    const getProductById = useCallback((id: string) => {
        return products.find((p: any) => p?._id === id);
    }, [products]);

    const getDealerById = useCallback((id: string) => {
        return dealers.find((d: any) => d?._id === id || d === id);
    }, [dealers]);

    const getWarehouseById = useCallback((id: string) => {
        return warehouses.find((w: any) => w?._id === id);
    }, [warehouses]);

    const calcItem = useCallback((it: any, perBox: number) => {
        const totalPieces = it.boxes * perBox + it.looseItems;
        const totalAmount = totalPieces * it.purchasePrice;
        const taxAmount = it.taxPercent > 0
            ? (totalAmount * it.taxPercent) / (100 + it.taxPercent)
            : 0;
        const baseAmount = totalAmount - taxAmount;

        return {
            totalPieces,
            baseAmount,
            taxAmount,
            finalAmount: totalAmount,
        };
    }, []);

    const calcPurchaseTotal = useCallback((items: any[]): number => {
        return items.reduce((sum, it) => {
            const pid = typeof it.productId === "string" ? it.productId : it.productId?._id;
            const perBox = getProductById(pid || "")?.perBoxItem ?? 1;
            const qty = it.boxes * perBox + it.looseItems;
            return sum + qty * it.purchasePrice;
        }, 0);
    }, [getProductById]);

    const filteredPurchases = useMemo(() => {
        return purchases.filter((p: any) => {
            const d = new Date(p.purchaseDate ?? p.createdAt);
            const now = new Date();

            // Date filtering
            let dateMatch = true;
            if (filterType === "thisMonth") {
                dateMatch = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            } else if (filterType === "lastMonth") {
                const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                dateMatch = d.getMonth() === last.getMonth() && d.getFullYear() === last.getFullYear();
            } else if (filterType === "custom" && fromDate && toDate) {
                dateMatch = d >= new Date(fromDate) && d <= new Date(toDate);
            }

            // Search filtering
            let searchMatch = true;
            if (searchTerm) {
                const dealerName = getDealerById(typeof p.dealerId === "string" ? p.dealerId : p.dealerId?._id || "")?.name || "";
                const productNames = p.items?.map((it: any) =>
                    getProductById(typeof it.productId === "string" ? it.productId : it.productId?._id || "")?.name || ""
                ).join(" ");
                searchMatch = dealerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    productNames.toLowerCase().includes(searchTerm.toLowerCase());
            }

            return dateMatch && searchMatch;
        });
    }, [purchases, filterType, fromDate, toDate, searchTerm, getDealerById, getProductById]);

    const addItem = (): void => {
        setItems((prev) => [...prev, { productId: "", boxes: 0, looseItems: 0, purchasePrice: 0, taxPercent: 0 }]);
    };

    const removeItem = (index: number): void => {
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const onSelectProduct = (index: number, pid: string): void => {
        const product = products.find((p: any) => p?._id === pid);
        if (!product) return;

        setItems((prev) => {
            const copy = [...prev];

            copy[index] = {
                ...copy[index],
                productId: pid,
                purchasePrice: product.purchasePrice || 0,
                taxPercent: product.taxPercent || 0
            };

            const isLastRow = index === prev.length - 1;
            const lastRowHasProduct = copy[index].productId !== "";

            if (isLastRow && lastRowHasProduct) {
                copy.push({
                    productId: "",
                    boxes: 0,
                    looseItems: 0,
                    purchasePrice: 0,
                    taxPercent: 0
                });
            }

            return copy;
        });
    };


    const updateItem = (index: number, key: keyof PurchaseItem, value: number): void => {
        setItems((prev) => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [key]: value };
            return copy;
        });
    };

    const resetForm = () => {
        setDealerId("");
        setWarehouseId("");
        setItems([]);
        setPurchaseDate("");
        setEditingPurchaseId(null);
    };

    const buildConfirmHtml = (cleanedItems: PurchaseItem[]) => {
        const lines = cleanedItems.map((it) => {
            const product = getProductById(it.productId);
            const name = product?.name || "Unknown Product";
            return `<li><b>${name}</b> — Boxes: ${it.boxes}, Loose: ${it.looseItems}</li>`;
        });

        return `<div style="text-align:left;"><p>Selected items:</p><ul>${lines.join("")}</ul></div>`;
    };

    const savePurchase = async (): Promise<void> => {
        const cleanedItems = items.filter((it) => it.productId);
        if (!dealerId || !warehouseId || cleanedItems.length === 0) {
            Swal.fire("Validation Error", "Please fill all required fields", "warning");
            return;
        }

        try {
            const confirm = await Swal.fire({
                title: editingPurchaseId ? "Confirm Update" : "Confirm Purchase",
                html: buildConfirmHtml(cleanedItems),
                icon: "question",
                showCancelButton: true,
                confirmButtonText: editingPurchaseId ? "Update" : "Save",
                cancelButtonText: "Cancel",
            });

            if (!confirm.isConfirmed) return;

            if (editingPurchaseId) {
                await dispatch(
                    updatePurchase({
                        id: editingPurchaseId,
                        payload: { dealerId, warehouseId, items: cleanedItems, purchaseDate },
                    })
                ).unwrap();
            } else {
                await dispatch(createPurchase({ dealerId, warehouseId, items: cleanedItems, purchaseDate })).unwrap();
            }
            await dispatch(fetchPurchases()).unwrap();
            setOpen(false);
            resetForm();
            Swal.fire("Success", editingPurchaseId ? "Purchase updated successfully" : "Purchase created successfully", "success");
        } catch (error: any) {
            const msg =
                (error && typeof error === "object" && "message" in error && error.message)
                    ? String(error.message)
                    : editingPurchaseId
                        ? "Failed to update purchase"
                        : "Failed to create purchase";

            Swal.fire("Error", msg, "error");
        }
    };

    const scrollTable = (direction: 'left' | 'right'): void => {
        const table = document.querySelector('.purchase-table') as HTMLElement;
        if (table) {
            table.scrollLeft += direction === 'right' ? 300 : -300;
        }
    };

    const resolveDealer = useCallback((dealerRef: any) => {
        if (!dealerRef) return null;

        if (typeof dealerRef === "object") return dealerRef;

        return dealers.find((d: any) => d?._id === dealerRef) || null;
    }, [dealers]);
    const router = useRouter();

    const loadPurchaseForEdit = (purchase: any) => {
        setEditingPurchaseId(purchase._id);
        setDealerId(
            typeof purchase.dealerId === "string"
                ? purchase.dealerId
                : purchase.dealerId?._id || ""
        );
        setWarehouseId(
            typeof purchase.warehouseId === "string"
                ? purchase.warehouseId
                : purchase.warehouseId?._id || ""
        );
        const dateSource = purchase.purchaseDate ?? purchase.createdAt;
        setPurchaseDate(new Date(dateSource).toISOString().slice(0, 10));

        const mappedItems: PurchaseItem[] = (purchase.items || []).map((it: any) => ({
            productId: typeof it.productId === "string" ? it.productId : it.productId?._id || "",
            boxes: it.boxes ?? 0,
            looseItems: it.looseItems ?? 0,
            purchasePrice: it.purchasePrice ?? 0,
            taxPercent: it.taxPercent ?? 0,
        }));

        setItems(mappedItems.length ? mappedItems : [{ productId: "", boxes: 0, looseItems: 0, purchasePrice: 0, taxPercent: 0 }]);
        setOpen(true);
    };

    const buildGSTPurchaseReport = useCallback(() => {
        const rows: any[] = [];

        filteredPurchases.forEach((purchase: any) => {
            const dealer = resolveDealer(purchase.dealerId);
            const dealerState = "Madhya Pradesh"; // MP fixed as per requirement
            const isIntraState = dealerState === "Madhya Pradesh";

            purchase.items?.forEach((it: any) => {
                const pid =
                    typeof it.productId === "string"
                        ? it.productId
                        : it.productId?._id;

                const product = getProductById(pid || "");
                const perBox = product?.perBoxItem ?? 1;
                const qty = it.boxes * perBox + it.looseItems;

                const totalAmount = qty * it.purchasePrice;
                const taxAmount =
                    it.taxPercent > 0
                        ? (totalAmount * it.taxPercent) / (100 + it.taxPercent)
                        : 0;

                const taxableValue = totalAmount - taxAmount;

                rows.push({
                    Invoice_No: `PUR-${purchase._id.slice(-6)}`,
                    Invoice_Date: new Date(purchase.purchaseDate ?? purchase.createdAt).toLocaleDateString("en-IN"),
                    Supplier_Name: dealer?.name || "",
                    Supplier_GSTIN: dealer?.gstin || "",
                    State: dealerState,
                    Product_Name: product?.name || "",
                    HSN: product?.hsnCode || "",
                    Quantity: qty,
                    Taxable_Value: taxableValue.toFixed(2),
                    GST_Rate: it.taxPercent,
                    CGST: isIntraState ? (taxAmount / 2).toFixed(2) : "0.00",
                    SGST: isIntraState ? (taxAmount / 2).toFixed(2) : "0.00",
                    IGST: !isIntraState ? taxAmount.toFixed(2) : "0.00",
                    Total_Amount: totalAmount.toFixed(2),
                    ITC_Eligible: "YES",
                });
            });
        });

        return rows;
    }, [filteredPurchases, getProductById, resolveDealer]);
    const exportGSTJSON = () => {
        const data = buildGSTPurchaseReport();

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "purchase-gst-report.json";
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportGSTExcel = () => {
        const data = buildGSTPurchaseReport();

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase GST");

        XLSX.writeFile(workbook, "purchase-gst-report.xlsx");
    };

    return (
        <div className="min-h-screen bg-slate-50 py-4 px-3 sm:px-4 lg:px-6">
            <div className="mx-auto max-w-7xl space-y-5">
                {/* TOP BAR */}
                <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase">Purchases</p>
                        <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
                            Purchase Management Dashboard
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Track all inventory purchases with detailed item breakdowns
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            resetForm();
                            setOpen(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4" />
                        New Purchase
                    </button>
                </header>

                {/* FILTERS CARD */}
                <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="w-full md:max-w-sm relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by dealer or product..."
                                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {[
                                { type: "all" as DateFilter, label: "All time" },
                                { type: "thisMonth" as DateFilter, label: "This month" },
                                { type: "lastMonth" as DateFilter, label: "Last month" },
                                { type: "custom" as DateFilter, label: "Custom" },
                            ].map(({ type, label }) => (
                                <button
                                    key={type}
                                    onClick={() => setFilterType(type)}
                                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${filterType === type
                                        ? "bg-blue-600 text-white shadow-sm"
                                        : "bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                                        }`}
                                >
                                    <Calendar className="h-3.5 w-3.5" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filterType === "custom" && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                                    From
                                </label>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                                    To
                                </label>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </div>
                        </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            onClick={exportGSTExcel}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                            Export GST Excel
                        </button>

                        <button
                            onClick={exportGSTJSON}
                            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900"
                        >
                            Export GST JSON
                        </button>
                    </div>


                    <p className="mt-3 text-xs text-slate-500">
                        Showing {filteredPurchases.length} purchases
                    </p>
                </section>

                {/* PURCHASES TABLE */}
                <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6">
                        <div>
                            <h2 className="text-sm font-semibold text-slate-900">
                                Purchase Orders
                            </h2>
                            <p className="mt-0.5 text-xs text-slate-500">
                                Detailed breakdown by dealer, warehouse and items
                            </p>
                        </div>
                        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                            {filteredPurchases.length} purchases
                        </span>
                    </div>

                    {/* Mobile scroll controls */}
                    <div className="lg:hidden bg-gradient-to-r from-slate-50 to-slate-100 p-4 flex items-center justify-between">
                        <button
                            onClick={() => scrollTable('left')}
                            className="p-2 rounded-lg bg-white border shadow-sm hover:bg-slate-50 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="font-medium text-sm text-slate-700">Horizontal scroll →</span>
                        <button
                            onClick={() => scrollTable('right')}
                            className="p-2 rounded-lg bg-white border shadow-sm hover:bg-slate-50 transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="overflow-x-auto lg:overflow-visible purchase-table">
                        <table className="min-w-[1400px] lg:min-w-full w-full text-sm">
                            <thead className="bg-slate-50">
                                <tr className="text-sm font-semibold uppercase tracking-wide ">
                                    <th className="py-3 pl-6 pr-2 text-left">Dealer</th>
                                    <th className="px-2 py-3 text-left">Address</th>
                                    <th className="px-2 py-3 text-center">Items</th>
                                    <th className="px-2 py-3 text-center">Date</th>
                                    <th className="px-2 py-3 text-center">PUR No</th>
                                    <th className="px-2 py-3 text-center">Action</th>

                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 ">
                                {filteredPurchases.map((purchase: any) => {
                                    const dealer = resolveDealer(purchase.dealerId);
                                    const warehouse = getWarehouseById(purchase.warehouseId || "");
                                    const totalAmount = calcPurchaseTotal(purchase.items || []);

                                    return (
                                        <React.Fragment key={purchase._id}>
                                            {/* MAIN ROW */}
                                            <tr className="bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-colors">

                                                <td className="py-3 pl-6 pr-2 font-semibold">
                                                    <div className="text-slate-900 mb-1">
                                                        {dealer?.name || "N/A"}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {dealer?.phone || ""}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-3 text-sm text-slate-700 max-w-xs truncate">
                                                    {dealer?.address || "—"}
                                                </td>
                                                <td className="px-2 py-3 text-center">
                                                    <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                                        {purchase.items?.length || 0}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-3 text-center text-sm font-medium text-slate-900">
                                                    {new Date(purchase.purchaseDate ?? purchase.createdAt).toLocaleDateString("en-IN")}
                                                </td>
                                                <td className="px-2 py-3 text-center text-sm font-medium text-slate-900">
                                                    PUR-{purchase._id.slice(-6)}
                                                </td>
                                                <td className="px-2 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => loadPurchaseForEdit(purchase)}
                                                            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-600"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => router.push(`/print/purchase-bill/${purchase._id}`)}
                                                            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                                        >
                                                            🖨 Print
                                                        </button>
                                                    </div>
                                                </td>

                                            </tr>
                                            {/* updated */}
                                            {/* DETAILS ROW - FULL PRODUCT BREAKDOWN */}
                                            <tr className="bg-slate-50/50">
                                                <td colSpan={4} className="p-0">
                                                    <div className="border-t border-slate-200">
                                                        <div className="grid grid-cols-7 gap-4 p-6 bg-slate-50 text-xs font-medium uppercase tracking-wide">
                                                            <div>Product</div>
                                                            <div className="text-center">Boxes</div>
                                                            <div className="text-center">Loose</div>
                                                            <div className="text-center">Per Box</div>
                                                            <div className="text-center">Qty</div>
                                                            <div className="text-center">Tax</div>
                                                            <div className="text-right">Amount</div>
                                                        </div>

                                                        {purchase.items?.map((it: any, itemIndex: number) => {
                                                            const pid = typeof it.productId === "string" ? it.productId : it.productId?._id;
                                                            const product = getProductById(pid || "");
                                                            const perBox = product?.perBoxItem ?? 1;
                                                            const calc = calcItem(it, perBox);

                                                            return (
                                                                <div key={`${purchase._id}-${pid}`} className="grid grid-cols-7 gap-4 p-4 border-t bg-white text-sm hover:bg-slate-50">
                                                                    <div className="font-medium text-slate-900">
                                                                        {product?.name || "N/A"}
                                                                    </div>
                                                                    <div className="text-center font-mono font-semibold text-slate-900">
                                                                        {it.boxes}
                                                                    </div>
                                                                    <div className="text-center font-mono font-semibold text-slate-900">
                                                                        {it.looseItems}
                                                                    </div>
                                                                    <div className="text-center font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                                                                        {perBox}
                                                                    </div>
                                                                    <div className="text-center font-bold text-xl text-indigo-600">
                                                                        {calc.totalPieces}
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <div className="text-xs text-slate-500">{it.taxPercent}%</div>
                                                                        <div className="font-mono text-emerald-600">
                                                                            {currency.format(calc.taxAmount)}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="text-lg font-black text-slate-900">
                                                                            {currency.format(calc.finalAmount)}
                                                                        </div>
                                                                        <div className="text-xs text-slate-500 line-through">
                                                                            {currency.format(calc.baseAmount)}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}

                                                        {/* TOTAL ROW */}
                                                        <div className="grid grid-cols-7 gap-4 p-6 bg-emerald-50/50 border-t-2 border-emerald-200 mb-4">
                                                            <div className="font-bold text-lg text-slate-900 col-span-5">
                                                                GRAND TOTAL ({purchase.items?.length || 0} items)
                                                            </div>
                                                            <div></div>
                                                            <div className="text-right">
                                                                <div className="text-2xl font-black text-emerald-700 tracking-wide">
                                                                    {currency.format(totalAmount)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })}

                                {filteredPurchases.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-12 text-center text-sm text-slate-500">
                                            No purchases match the current filters
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* MODAL */}
                <AnimatePresence>
                    {open && (
                        <motion.div
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <motion.div
                                className="bg-white w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden"
                                initial={{ scale: 0.95, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.95, y: 20 }}
                            >
                                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h2 className="text-2xl font-bold">
                                                {editingPurchaseId ? "Edit Purchase Order" : "New Purchase Order"}
                                            </h2>
                                            <p className="text-slate-300">
                                                {editingPurchaseId ? "Update existing inventory purchase" : "Create new inventory purchase"}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setOpen(false);
                                                resetForm();
                                            }}
                                            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                                        >
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-3 max-h-[70vh] overflow-y-auto">
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-3">
                                        <div className="flex gap-2">
                                            <select
                                                value={dealerId}
                                                onChange={(e) => setDealerId(e.target.value)}
                                                className="flex-1 p-2 border border-slate-200 rounded-xl"
                                            >
                                                <option value="">Select Dealer</option>
                                                {dealers.map((d: any) => (
                                                    <option key={d._id} value={d._id}>
                                                        {d.name}
                                                    </option>
                                                ))}
                                            </select>

                                            <button
                                                type="button"
                                                onClick={() => setOpenDealer(true)}
                                                className="px-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                                            >
                                                + Add
                                            </button>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-3">
                                                Warehouse *
                                            </label>
                                            <select
                                                value={warehouseId}
                                                onChange={(e) => setWarehouseId(e.target.value)}
                                                className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                                required
                                            >
                                                <option value="">Select Warehouse</option>
                                                {warehouses.map((warehouse: any) => (
                                                    <option key={warehouse?._id} value={warehouse?._id}>
                                                        {warehouse?.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-3">
                                                Purchase Date
                                            </label>
                                            <input
                                                type="date"
                                                value={purchaseDate}
                                                onChange={(e) => setPurchaseDate(e.target.value)}
                                                className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4 mb-4">
                                        <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                                            <h3 className="text-xl font-semibold text-slate-900">Purchase Items</h3>
                                            <button
                                                type="button"
                                                onClick={addItem}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add Item
                                            </button>
                                        </div>

                                        {items.map((item, index) => (
                                            <div key={`item-${index}`} className="border border-slate-200 rounded-xl p-3 hover:shadow-md transition-all">
                                                <div className="flex justify-between items-start mb-4">
                                                    <h4 className="font-semibold text-lg text-slate-900">Item {index + 1}</h4>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(index)}
                                                        className="text-red-500 hover:text-red-700 font-medium"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                                                    <div className="lg:col-span-1">
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                                            Product *
                                                        </label>
                                                        <Select
                                                            options={products.map((product: any) => ({
                                                                value: product._id,
                                                                label: `${product.name} - ₹${product.purchasePrice || 0}`
                                                            }))}
                                                            value={
                                                                item.productId
                                                                    ? {
                                                                        value: item.productId,
                                                                        label: `${products.find((p: any) => p._id === item.productId)?.name
                                                                            } - ₹${products.find((p: any) => p._id === item.productId)?.purchasePrice || 0
                                                                            }`,
                                                                    }
                                                                    : null
                                                            }
                                                            onChange={(selected: any) => {
                                                                if (selected) {
                                                                    onSelectProduct(index, selected.value);
                                                                }
                                                            }}
                                                            placeholder="Search & select product..."
                                                            isSearchable
                                                            className="text-sm"
                                                            styles={{
                                                                control: (base) => ({
                                                                    ...base,
                                                                    padding: "6px",
                                                                    borderRadius: "12px",
                                                                    borderColor: "#e2e8f0",
                                                                    boxShadow: "none",
                                                                    "&:hover": {
                                                                        borderColor: "#3b82f6",
                                                                    },
                                                                }),
                                                                menu: (base) => ({
                                                                    ...base,
                                                                    borderRadius: "12px",
                                                                    overflow: "hidden",
                                                                }),
                                                            }}
                                                        />

                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                                            Boxes
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={item.boxes || ""}
                                                            onChange={(e) => updateItem(index, "boxes", Number(e.target.value) || 0)}
                                                            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-mono text-md"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                                            Loose Items
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={item.looseItems || ""}
                                                            onChange={(e) => updateItem(index, "looseItems", Number(e.target.value) || 0)}
                                                            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-mono text-md"
                                                        />
                                                    </div>
                                                    <div className="lg:col-span-1 text-right pt-4">
                                                        <div className="text-2xl font-bold text-slate-900 mb-1">
                                                            {currency.format(item.purchasePrice)}
                                                        </div>
                                                        <div className="text-sm text-slate-500">{item.taxPercent}% Tax</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-4 pt-3 border-t border-slate-200">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOpen(false);
                                                resetForm();
                                            }}
                                            className="flex-1 px-3 py-3 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={savePurchase}
                                            disabled={!dealerId || !warehouseId || items.filter((it) => it.productId).length === 0}
                                            className="flex-1 px-3 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-4 focus:ring-blue-500"
                                        >
                                            {editingPurchaseId ? "Update Purchase" : "Save Purchase"}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {openDealer && (
                        <motion.div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <motion.div
                                className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
                                initial={{ scale: 0.95, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.95, y: 20 }}
                            >
                                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white">
                                    <h2 className="text-xl font-bold">Add New Dealer</h2>
                                    <p className="text-slate-300 text-sm">Create dealer profile</p>
                                </div>

                                <div className="p-6 space-y-4">
                                    <input
                                        placeholder="Dealer Name *"
                                        className="w-full p-3 border rounded-xl"
                                        value={dealerForm.name}
                                        onChange={(e) => setDealerForm({ ...dealerForm, name: e.target.value })}
                                    />

                                    <input
                                        placeholder="Phone *"
                                        className="w-full p-3 border rounded-xl"
                                        value={dealerForm.phone}
                                        onChange={(e) => setDealerForm({ ...dealerForm, phone: e.target.value })}
                                    />

                                    <input
                                        placeholder="Address"
                                        className="w-full p-3 border rounded-xl"
                                        value={dealerForm.address}
                                        onChange={(e) => setDealerForm({ ...dealerForm, address: e.target.value })}
                                    />

                                    <input
                                        placeholder="GSTIN"
                                        className="w-full p-3 border rounded-xl"
                                        value={dealerForm.gstin}
                                        onChange={(e) => setDealerForm({ ...dealerForm, gstin: e.target.value })}
                                    />
                                </div>

                                <div className="flex gap-3 p-6 border-t">
                                    <button
                                        onClick={() => setOpenDealer(false)}
                                        className="flex-1 border rounded-xl py-2"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!dealerForm.name || !dealerForm.phone) {
                                                Swal.fire("Required", "Name & Phone required", "warning");
                                                return;
                                            }

                                            await dispatch(createDealer(dealerForm)).unwrap();
                                            Swal.fire("Success", "Dealer added", "success");

                                            setDealerForm({ name: "", phone: "", address: "", gstin: "" });
                                            setOpenDealer(false);
                                        }}
                                        className="flex-1 bg-emerald-600 text-white rounded-xl py-2 font-semibold"
                                    >
                                        Save Dealer
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
}

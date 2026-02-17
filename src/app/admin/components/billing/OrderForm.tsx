"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import {
  CustomerFormState,
  BillFormItemState,
  BillingProductOption,
  Totals,
} from "./BillingAdminPage";
import { CreateBillPaymentInput } from "@/store/billingApi";

interface OrderFormProps {
  mode: "create" | "edit";
  companyGstNumber: string;
  customer: CustomerFormState;
  setCustomer: (customer: CustomerFormState) => void;
  items: BillFormItemState[];
  setItems: React.Dispatch<
    React.SetStateAction<BillFormItemState[]>
  >;
  payment: CreateBillPaymentInput;
  setPayment: React.Dispatch<
    React.SetStateAction<CreateBillPaymentInput>
  >;
  customerSearch: string;
  setCustomerSearch: (search: string) => void;
  selectedCustomerId: string;
  customerSearchResult?: {
    customers: {
      _id?: string;
      name: string;
      shopName?: string;
      phone: string;
      address?: string;
      gstNumber?: string;
      customPrices?: { product: string; price: number }[];
    }[];
  };
  billingProducts: BillingProductOption[];
  inventoryLoading: boolean;
  totals: Totals;
  onCustomerSelect: (id: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  billDate: string;
  setBillDate: (date: string) => void;
}

const safeNum = (v: unknown, fb = 0) =>
  Number.isFinite(Number(v)) ? Number(v) : fb;
const randomId = () => crypto.randomUUID();

export default function OrderForm({
  mode,
  companyGstNumber,
  customer,
  setCustomer,
  items,
  setItems,
  payment,
  setPayment,
  customerSearch,
  setCustomerSearch,
  selectedCustomerId,
  customerSearchResult,
  billingProducts,
  inventoryLoading,
  totals,
  onCustomerSelect,
  onSubmit,
  isSubmitting,
  billDate,
  setBillDate,
}: OrderFormProps) {
  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      {
        id: randomId(),
        productSearch: "",
        selectedProduct: undefined,
        quantityBoxes: 0,
        quantityLoose: 0,
        discountType: "NONE",
        discountValue: 0,
        overridePriceForCustomer: false,
      },
    ]);
  }, [setItems]);

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    },
    [setItems]
  );

  const updateItem = useCallback(
    (id: string, updates: Partial<BillFormItemState>) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        )
      );
    },
    [setItems]
  );

  const getFilteredProducts = useCallback(
    (search: string): BillingProductOption[] => {
      if (!search.trim()) return billingProducts;
      const lower = search.toLowerCase();
      return billingProducts
        .filter((p) =>
          p.productName.toLowerCase().includes(lower)
        )
        .slice(0, 40);
    },
    [billingProducts]
  );

  const cgst = totals.totalTax / 2;
  const sgst = totals.totalTax / 2;

  const customers =
    customerSearchResult?.customers ??
    [];

  const totalDiscount = useMemo(() => {
    return items.reduce((sum, item) => {
      const p = item.selectedProduct;
      if (!p) return sum;

      const pcs =
        item.quantityBoxes * p.itemsPerBox +
        item.quantityLoose;

      const base = pcs * p.sellingPrice;

      let discount = 0;
      if (item.discountType === "PERCENT") {
        discount = (base * item.discountValue) / 100;
      } else if (item.discountType === "CASH") {
        discount = item.discountValue;
      }

      // ✅ discount cap
      return sum + Math.min(discount, base);
    }, 0);
  }, [items]);

  useEffect(() => {
  const last = items[items.length - 1];
  if (last && last.selectedProduct) {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productSearch: "",
        selectedProduct: undefined,
        quantityBoxes: 0,
        quantityLoose: 0,
        discountType: "NONE",
        discountValue: 0,
        overridePriceForCustomer: false,
      },
    ]);
  }
}, [items, setItems]);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_0_0,_rgba(59,130,246,0.08),_transparent_55%),_radial-gradient(circle_at_100%_0,_rgba(34,197,94,0.08),_transparent_55%)]" />
      <div className="rounded-3xl border border-slate-200 bg-white/90 shadow-xl shadow-sky-100 p-6 lg:p-7 space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live billing session
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              {mode === "edit" ? "Edit Bill" : "Create New Bill"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Premium light UI to search customer, select products and apply discounts.
            </p>
          </div>
          <div className="text-right space-y-1">
            <div className="text-[11px] uppercase text-slate-400 tracking-[0.18em]">
              BILL MODE
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-800 ring-1 ring-slate-200">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-500 text-[11px] font-semibold text-white shadow-md shadow-sky-200">
                {mode === "edit" ? "E" : "N"}
              </span>
              {mode === "edit" ? "Editing existing bill" : "New bill draft"}
            </div>
          </div>
        </div>
        

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_420px] gap-6">

          {/* LEFT: CUSTOMER + ITEMS */}
          <div className="space-y-5">
            {/* CUSTOMER */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[13px] text-sky-600 border border-slate-200">
                    C
                  </span>
                  Customer
                </h3>
                <div className="text-[11px] text-slate-500">
                  GST:{" "}
                  <span className="font-mono text-slate-800">
                    {companyGstNumber}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-medium text-slate-700">
                    Search customer
                  </label>
                  <div className="">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) =>
                        setCustomerSearch(e.target.value)
                      }
                      placeholder="Type name, shop name or phone..."
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                    {customerSearchResult?.customers?.length &&
                      customerSearchResult.customers.length > 0 ? (
                      <div className=" z-30 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/80">
                        {customerSearchResult.customers.map(
                          (cust) => (
                            <button
                              key={cust._id}
                              type="button"
                              onClick={() =>
                                onCustomerSelect(cust._id ?? "")
                              }
                              className="w-full px-3.5 py-2.5 text-left text-sm hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-medium text-slate-900">
                                    {cust.shopName || cust.name}
                                  </div>
                                  <div className="text-xs text-slate-600">
                                    {cust.name}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {cust.phone}
                                  </div>
                                </div>
                                {cust.shopName && (
                                  <div className="text-[11px] text-slate-500">
                                    Shop
                                  </div>
                                )}
                              </div>
                            </button>
                          )
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={customer.name}
                    onChange={(e) =>
                      setCustomer({
                        ...customer,
                        name: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    value={customer.phone}
                    onChange={(e) =>
                      setCustomer({
                        ...customer,
                        phone: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Shop name
                  </label>
                  <input
                    type="text"
                    value={customer.shopName || ""}
                    onChange={(e) =>
                      setCustomer({
                        ...customer,
                        shopName: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    GST number
                  </label>
                  <input
                    type="text"
                    value={customer.gstNumber || ""}
                    onChange={(e) =>
                      setCustomer({
                        ...customer,
                        gstNumber: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-medium text-slate-700">
                    Address
                  </label>
                  <textarea
                    value={customer.address}
                    onChange={(e) =>
                      setCustomer({
                        ...customer,
                        address: e.target.value,
                      })
                    }
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
              </div>
            </div>

            {/* ITEMS */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Items
                  </h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500 border border-slate-200">
                    {items.length} line
                    {items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 px-3 py-1.5 text-xs font-medium text-white shadow-md shadow-sky-200 hover:from-sky-400 hover:to-emerald-400 transition"
                >
                  <span className="text-base leading-none">＋</span>
                  Add item
                </button>
              </div>

              <div className="space-y-3 max-h-[26rem] overflow-auto pr-1">
                {items.map((item, index) => {
                  const filteredProducts =
                    getFilteredProducts(item.productSearch);
                  const p = item.selectedProduct;
                  const maxBoxes = p?.boxesAvailable ?? Infinity;

                  let totalPieces = 0;
                  let baseTotal = 0;
                  let discountAmount = 0;
                  let lineTotal = 0;

                  if (p) {
                    totalPieces =
                      item.quantityBoxes * p.itemsPerBox +
                      item.quantityLoose;
                    baseTotal = totalPieces * p.sellingPrice;
                    if (item.discountType === "PERCENT") {
                      discountAmount = (baseTotal * item.discountValue) / 100;
                    } else if (item.discountType === "CASH") {
                      discountAmount = item.discountValue;
                    }

                    /* ✅ CAP discount so it never exceeds base total */
                    discountAmount = Math.min(discountAmount, baseTotal);

                    lineTotal = baseTotal - discountAmount;

                  }

                  return (
                    <div
                      key={item.id}
                      className="relative rounded-2xl border border-slate-200 bg-white px-3.5 py-3 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-700 border border-slate-200">
                            {index + 1}
                          </span>
                          <span>
                            {p?.productName || "Select product"}
                          </span>
                        </div>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-[11px] text-rose-500 hover:text-rose-600"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      {/* PRODUCT SELECT + SEARCH */}
                      <div className="grid gap-2 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium text-slate-700">
                            Product
                          </label>
                          <select
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                            disabled={mode === "edit"}
                            value={item.selectedProduct?.id || ""}
                            onChange={(e) => {
                              if (mode === "edit") return;

                              const selected = billingProducts.find(
                                (p) => p.id === e.target.value
                              );

                              if (!selected) return;

                              updateItem(item.id, {
                                selectedProduct: {
                                  ...selected,
                                  sellingPrice:
                                    item.selectedProduct?.sellingPrice ?? selected.sellingPrice,
                                },
                                productSearch: selected.productName,
                              });
                            }}

                          >
                            <option value="">Select product...</option>
                            {billingProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.productName} ({p.warehouseName})
                              </option>
                            ))}
                          </select>

                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium text-slate-700">
                            Quick search
                          </label>
                          <div className="">
                            <input
                              type="text"
                              value={item.productSearch}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  productSearch: e.target.value,
                                })
                              }
                              placeholder="Type name..."
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                            />
                            {filteredProducts.length > 0 && (
                              <div className=" z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/80">
                                {filteredProducts.map((fp) => (
                                  <button
                                    type="button"
                                    key={fp.id}
                                    onClick={() =>
                                      updateItem(item.id, {
                                        selectedProduct: {
                                          ...fp,
                                          sellingPrice:
                                            item.selectedProduct?.sellingPrice ?? fp.sellingPrice,
                                        },
                                        productSearch: fp.productName,
                                      })
                                    }
                                    className="w-full px-3 py-2 text-left text-xs sm:text-sm hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                                  >


                                    <div className="font-medium text-slate-900">
                                      {fp.productName}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {fp.warehouseName} • ₹
                                      {fp.sellingPrice.toFixed(
                                        2
                                      )}{" "}
                                      per piece •{" "}
                                      {fp.itemsPerBox} / box
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {p && (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span>
                              Stock:{" "}
                              <span className="text-slate-800">
                                {p.boxesAvailable}
                              </span>{" "}
                              box •{" "}
                              <span className="text-slate-800">
                                {p.itemsPerBox}
                              </span>{" "}
                              per box
                            </span>
                            <span>
                              Rate:{" "}
                              <span className="text-emerald-600">
                                ₹{p.sellingPrice.toFixed(2)}
                              </span>{" "}
                              / piece
                            </span>
                          </div>

                          {/* QUANTITY + SUMMARY */}
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="text-[11px] font-medium text-slate-700">
                                  Boxes
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={maxBoxes}
                                  value={item.quantityBoxes || ""}
                                  onChange={(e) => {
                                    let val = safeNum(
                                      e.target.value
                                    );
                                    if (val < 0) val = 0;
                                    if (val > maxBoxes)
                                      val = maxBoxes;

                                    const totalPieces =
                                      val * p.itemsPerBox +
                                      item.quantityLoose;
                                    const newBoxes = Math.min(
                                      maxBoxes,
                                      Math.floor(
                                        totalPieces /
                                        p.itemsPerBox
                                      )
                                    );
                                    const newLoose =
                                      totalPieces -
                                      newBoxes *
                                      p.itemsPerBox;

                                    updateItem(item.id, {
                                      quantityBoxes: newBoxes,
                                      quantityLoose: newLoose,
                                    });
                                  }}
                                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                />
                                <div className="mt-0.5 text-[10px] text-slate-500">
                                  Max {maxBoxes}
                                </div>
                              </div>
                              <div>
                                <label className="text-[11px] font-medium text-slate-700">
                                  Loose
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={item.quantityLoose || ""}
                                  onChange={(e) => {
                                    let looseVal = safeNum(
                                      e.target.value
                                    );
                                    if (looseVal < 0)
                                      looseVal = 0;

                                    const totalPieces =
                                      item.quantityBoxes *
                                      p.itemsPerBox +
                                      looseVal;

                                    let newBoxes = Math.floor(
                                      totalPieces / p.itemsPerBox
                                    );
                                    if (newBoxes > maxBoxes) {
                                      newBoxes = maxBoxes;
                                    }
                                    const newLoose =
                                      totalPieces -
                                      newBoxes *
                                      p.itemsPerBox;

                                    updateItem(item.id, {
                                      quantityBoxes: newBoxes,
                                      quantityLoose: newLoose,
                                    });
                                  }}
                                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                />
                                <div className="mt-0.5 text-[10px] text-slate-500">
                                  Auto converts to boxes when
                                  reaching {p.itemsPerBox}
                                </div>
                              </div>
                              <div>
                                <label className="text-[11px] font-medium text-slate-700">
                                  Total
                                </label>
                                <div className="mt-1 flex h-[38px] items-center justify-center rounded-xl bg-slate-50 text-xs font-semibold text-slate-900 border border-slate-200">
                                  {totalPieces}
                                </div>
                              </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] space-y-1.5">
                              <div className="flex justify-between">
                                <span className="text-slate-500">
                                  Gross
                                </span>
                                <span className="text-slate-900">
                                  ₹{baseTotal.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">
                                  Discount
                                </span>
                                <span className="text-emerald-600">
                                  −₹{discountAmount.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                                <span className="text-slate-700 font-medium">
                                  Line total
                                </span>
                                <span className="text-sky-700 font-semibold">
                                  ₹{lineTotal.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* PRICE + DISCOUNT */}
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="text-[11px] font-medium text-slate-700">
                                Price per piece
                              </label>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={p.sellingPrice || ""}
                                onChange={(e) => {
                                  updateItem(item.id, {
                                    selectedProduct: {
                                      ...p,
                                      sellingPrice: safeNum(e.target.value),
                                    },
                                    overridePriceForCustomer: true,
                                  });
                                }}


                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                              />
                              <div className="mt-0.5 text-[10px] text-slate-500">
                                ~ ₹
                                {(
                                  p.sellingPrice *
                                  p.itemsPerBox
                                ).toFixed(2)}{" "}
                                / box
                              </div>
                            </div>
                            <div>
                              <label className="text-[11px] font-medium text-slate-700">
                                Discount (on line total)
                              </label>
                              <div className="mt-1 grid grid-cols-[90px,1fr] gap-2">
                                <select
                                  value={item.discountType}
                                  onChange={(e) =>
                                    updateItem(item.id, {
                                      discountType:
                                        e.target.value as BillFormItemState["discountType"],
                                    })
                                  }
                                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                >
                                  <option value="NONE">
                                    None
                                  </option>
                                  <option value="PERCENT">
                                    % Percent
                                  </option>
                                  <option value="CASH">
                                    ₹ Cash
                                  </option>
                                </select>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={item.discountValue || ""}
                                  onChange={(e) =>
                                    updateItem(item.id, {
                                      discountValue: safeNum(
                                        e.target.value
                                      ),
                                    })
                                  }
                                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                  placeholder="0"
                                />
                              </div>
                              <div className="mt-0.5 text-[10px] text-slate-500">
                                Example: total 250 ho to 10% →
                                25 kam, ya 25₹ cash → 25 kam.
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: DATE + PAYMENT + TOTALS */}
          <div className="space-y-5">
            {/* DATE */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Bill meta
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-700">
                    Bill date
                  </label>
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-700">
                    Company GST
                  </label>
                  <div className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-mono text-slate-900">
                    {companyGstNumber}
                  </div>
                </div>
              </div>
            </div>

            {/* PAYMENT */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Payment split
              </h3>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-700">
                    Cash
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={payment.cashAmount || ""}
                    onChange={(e) =>
                      setPayment({
                        mode: payment.mode ?? "CASH",
                        cashAmount: safeNum(e.target.value),
                        upiAmount: payment.upiAmount ?? 0,
                        cardAmount: payment.cardAmount ?? 0,
                      })
                    }

                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-700">
                    UPI
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={payment.upiAmount || ""}
                    onChange={(e) =>
                      setPayment({
                        mode: payment.mode ?? "CASH",
                        cashAmount: payment.cashAmount ?? 0,
                        upiAmount: safeNum(e.target.value),
                        cardAmount: payment.cardAmount ?? 0,
                      })
                    }

                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-700">
                    Card
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={payment.cardAmount || ""}
                    onChange={(e) =>
                      setPayment({
                        mode: payment.mode ?? "CASH",
                        cashAmount: payment.cashAmount ?? 0,
                        upiAmount: safeNum(e.target.value),
                        cardAmount: payment.cardAmount ?? 0,
                      })
                    }

                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs sm:text-sm text-slate-600 border-t border-slate-200 pt-2 mt-1">
                <span>Total paid</span>
                <span className="font-semibold text-emerald-600">
                  ₹
                  {(
                    (payment.cashAmount ?? 0) +
                    (payment.upiAmount ?? 0) +
                    (payment.cardAmount ?? 0)
                  ).toFixed(2)}
                </span>
              </div>
            </div>

            {/* TOTALS */}
            <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-white via-sky-50 to-slate-50 px-5 py-4 space-y-3 shadow-md shadow-sky-100">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center justify-between">
                Summary
                <span className="text-[11px] font-normal text-slate-500">
                  {totals.totalItemsCount} pcs
                </span>
              </h3>
              <div className="space-y-1.5 text-xs sm:text-sm">
                <div className="flex justify-between text-slate-700">
                  <span>Sub total</span>
                  <span>₹{totals.totalBeforeTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Discount</span>
                  <span className="text-emerald-600">
                    −₹{totals.discountTotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>CGST</span>
                  <span>₹{cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>SGST</span>
                  <span>₹{sgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Total GST</span>
                  <span>₹{totals.totalTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Round</span>
                  <span>₹0.00</span>
                </div>
                <div className="border-t border-sky-200 pt-2 mt-1">
                  <div className="flex justify-between text-base font-semibold text-slate-900">
                    <span>Grand total</span>
                    <span>₹{totals.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-200 hover:from-sky-400 hover:to-blue-400 disabled:from-sky-300 disabled:to-blue-300 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : mode === "edit" ? (
                    "Update bill"
                  ) : (
                    "Create bill"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

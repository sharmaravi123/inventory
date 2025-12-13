"use client";

import React from "react";
import {
  BillingProductOption,
  CustomerFormState,
  BillFormItemState,
  Totals,
} from "./BillingAdminPage";

import {
  Customer,
  CreateBillPaymentInput,
  PaymentMode,
} from "@/store/billingApi";

const toNum = (v: unknown, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

export type OrderFormProps = {
  mode: "create" | "edit";

  companyGstNumber: string;

  customer: CustomerFormState;
  setCustomer: React.Dispatch<React.SetStateAction<CustomerFormState>>;

  items: BillFormItemState[];
  setItems: React.Dispatch<React.SetStateAction<BillFormItemState[]>>;

  payment: CreateBillPaymentInput;
  setPayment: React.Dispatch<React.SetStateAction<CreateBillPaymentInput>>;

  customerSearch: string;
  setCustomerSearch: React.Dispatch<React.SetStateAction<string>>;
  selectedCustomerId: string;

  customerSearchResult?: { customers: Customer[] };

  billingProducts: BillingProductOption[];
  inventoryLoading: boolean;

  totals: Totals;

  onCustomerSelect: (id: string) => void;

  billDate: string;
  setBillDate: (v: string) => void;

  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
};

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
  billDate,
  setBillDate,
  onSubmit,
  isSubmitting,
}: OrderFormProps) {
  const updateItem = (id: string, data: Partial<BillFormItemState>) =>
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...data } : it))
    );

  return (
    <div className="space-y-6">
      {/* ---------------- HEADER ---------------- */}
      <h2 className="text-lg font-semibold">
        {mode === "create" ? "Create Bill" : "Edit Bill"}
      </h2>

      {/* ---------------- CUSTOMER SECTION ---------------- */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
        {/* LEFT PANEL */}
        <div>
          <h3 className="font-semibold mb-2">Customer</h3>

          {/* CUSTOMER SEARCH */}
          <input
            type="text"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="border px-3 py-2 rounded w-full text-sm mb-2"
            placeholder="Search customer..."
          />

          {customerSearchResult?.customers?.length ? (
            <div className="border rounded bg-white max-h-40 overflow-auto">
              {customerSearchResult.customers.map((c) => (
                <button
                  key={c._id}
                  onClick={() => onCustomerSelect(c._id ?? "")}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-200 ${
                    selectedCustomerId === c._id ? "bg-gray-300" : ""
                  }`}
                >
                  {c.name} — {c.phone}
                </button>
              ))}
            </div>
          ) : null}

          {/* CUSTOMER FORM FIELDS */}
          <div className="space-y-2 mt-3 text-sm">
            <label>
              Name
              <input
                value={customer.name}
                onChange={(e) =>
                  setCustomer((p) => ({ ...p, name: e.target.value }))
                }
                className="border px-3 py-2 rounded w-full"
              />
            </label>

            <label>
              Shop
              <input
                value={customer.shopName}
                onChange={(e) =>
                  setCustomer((p) => ({ ...p, shopName: e.target.value }))
                }
                className="border px-3 py-2 rounded w-full"
              />
            </label>

            <label>
              Phone
              <input
                value={customer.phone}
                onChange={(e) =>
                  setCustomer((p) => ({ ...p, phone: e.target.value }))
                }
                className="border px-3 py-2 rounded w-full"
              />
            </label>

            <label>
              Address
              <textarea
                value={customer.address}
                onChange={(e) =>
                  setCustomer((p) => ({ ...p, address: e.target.value }))
                }
                className="border px-3 py-2 rounded w-full"
              />
            </label>

            <label>
              GST
              <input
                value={customer.gstNumber}
                onChange={(e) =>
                  setCustomer((p) => ({ ...p, gstNumber: e.target.value }))
                }
                className="border px-3 py-2 rounded w-full"
              />
            </label>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div>
          <h3 className="font-semibold">Bill Details</h3>

          <p className="text-xs text-gray-500 mt-2">Company GST</p>
          <p className="font-semibold">{companyGstNumber}</p>

          {/* BILL DATE */}
          <div className="mt-4">
            <label className="text-xs">Bill Date</label>
            <input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="border px-3 py-2 rounded w-full"
            />
          </div>
        </div>
      </section>

      {/* ---------------- PRODUCTS SECTION ---------------- */}
      <section className="p-4 bg-white rounded-lg shadow space-y-4">
        <h3 className="font-semibold">Products</h3>

        {items.map((row) => {
          const p = row.selectedProduct;

          const options = billingProducts.filter((bp) =>
            bp.productName.toLowerCase().includes(row.productSearch.toLowerCase())
          );

          return (
            <div key={row.id} className="border rounded p-3 space-y-3">
              {/* HEADER */}
              <div className="flex justify-between">
                <p className="font-medium">Item</p>
                {items.length > 1 && (
                  <button
                    className="text-red-600 text-xs"
                    onClick={() =>
                      setItems((prev) => prev.filter((it) => it.id !== row.id))
                    }
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* PRODUCT SEARCH INPUT */}
              <input
                value={row.productSearch}
                onChange={(e) =>
                  updateItem(row.id, { productSearch: e.target.value })
                }
                placeholder="Search product..."
                className="border px-3 py-2 rounded w-full"
              />

              {/* PRODUCT DROPDOWN */}
              <select
                value={p?.id ?? ""}
                onChange={(e) => {
                  const op = billingProducts.find((bp) => bp.id === e.target.value);
                  updateItem(row.id, {
                    selectedProduct: op,
                    quantityBoxes: 0,
                    quantityLoose: 0,
                    discountType: "NONE",
                    discountValue: 0,
                  });
                }}
                className="border px-3 py-2 rounded w-full"
              >
                <option value="">Select product</option>
                {options.map((bp) => (
                  <option key={bp.id} value={bp.id}>
                    {bp.productName} — ₹{bp.sellingPrice}
                  </option>
                ))}
              </select>

              {/* PRODUCT DETAILS */}
              {p && (
                <>
                  {/* QTY + PRICE */}
                  <div className="grid grid-cols-3 gap-3">
                    <label>
                      Boxes
                      <input
                        type="number"
                        min={0}
                        value={row.quantityBoxes}
                        onChange={(e) =>
                          updateItem(row.id, {
                            quantityBoxes: toNum(e.target.value),
                          })
                        }
                        className="border px-3 py-2 rounded w-full"
                      />
                    </label>

                    <label>
                      Loose
                      <input
                        type="number"
                        min={0}
                        value={row.quantityLoose}
                        onChange={(e) =>
                          updateItem(row.id, {
                            quantityLoose: toNum(e.target.value),
                          })
                        }
                        className="border px-3 py-2 rounded w-full"
                      />
                    </label>

                    <label>
                      Price
                      <input
                        type="number"
                        min={0}
                        value={p.sellingPrice}
                        onChange={(e) =>
                          updateItem(row.id, {
                            selectedProduct: {
                              ...p,
                              sellingPrice: toNum(e.target.value),
                            },
                          })
                        }
                        className="border px-3 py-2 rounded w-full"
                      />
                    </label>
                  </div>

                  {/* DISCOUNT */}
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <label>
                      Discount Type
                      <select
                        value={row.discountType}
                        onChange={(e) =>
                          updateItem(row.id, {
                            discountType: e.target.value as BillFormItemState["discountType"],
                            discountValue: 0,
                          })
                        }
                        className="border px-3 py-2 rounded w-full"
                      >
                        <option value="NONE">NONE</option>
                        <option value="PERCENT">PERCENT</option>
                        <option value="CASH">CASH</option>
                      </select>
                    </label>

                    <label>
                      Value
                      <input
                        type="number"
                        disabled={row.discountType === "NONE"}
                        value={row.discountValue}
                        onChange={(e) =>
                          updateItem(row.id, {
                            discountValue: toNum(e.target.value),
                          })
                        }
                        className="border px-3 py-2 rounded w-full"
                      />
                    </label>

                    <label className="flex items-center gap-2 mt-6">
                      <input
                        type="checkbox"
                        checked={row.overridePriceForCustomer}
                        onChange={(e) =>
                          updateItem(row.id, {
                            overridePriceForCustomer: e.target.checked,
                          })
                        }
                      />
                      Save price for this customer
                    </label>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* ADD ITEM BUTTON */}
        <button
          onClick={() =>
            setItems((prev) => [
              ...prev,
              { ...prev[0], id: crypto.randomUUID(), selectedProduct: undefined, quantityLoose: 0, quantityBoxes: 0 },
            ])
          }
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Add Item
        </button>
      </section>

      {/* ---------------- PAYMENT SECTION ---------------- */}
      <section className="p-4 bg-gray-50 rounded-xl space-y-3">
        <h3 className="font-semibold">Payment</h3>

        {/* PAYMENT MODE */}
        <div className="flex gap-2">
          {(["CASH", "UPI", "CARD", "SPLIT"] as PaymentMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setPayment((p) => ({ ...p, mode: m }))}
              className={`px-4 py-2 rounded border ${
                payment.mode === m
                  ? "bg-blue-100 border-blue-600 text-blue-600"
                  : "border-gray-300"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <p className="text-sm">Grand Total: ₹{totals.grandTotal.toFixed(2)}</p>

        {payment.mode !== "UPI" && payment.mode !== "CARD" && (
          <label>
            Cash
            <input
              type="number"
              value={payment.cashAmount}
              onChange={(e) =>
                setPayment((p) => ({ ...p, cashAmount: toNum(e.target.value) }))
              }
              className="border px-3 py-2 rounded w-full"
            />
          </label>
        )}

        {(payment.mode === "UPI" || payment.mode === "SPLIT") && (
          <label>
            UPI
            <input
              type="number"
              value={payment.upiAmount}
              onChange={(e) =>
                setPayment((p) => ({ ...p, upiAmount: toNum(e.target.value) }))
              }
              className="border px-3 py-2 rounded w-full"
            />
          </label>
        )}

        {(payment.mode === "CARD" || payment.mode === "SPLIT") && (
          <label>
            Card
            <input
              type="number"
              value={payment.cardAmount}
              onChange={(e) =>
                setPayment((p) => ({ ...p, cardAmount: toNum(e.target.value) }))
              }
              className="border px-3 py-2 rounded w-full"
            />
          </label>
        )}
      </section>

      {/* ---------------- SUMMARY SECTION ---------------- */}
      <section className="p-4 bg-white rounded shadow">
        <h3 className="font-semibold">Summary</h3>

        <div className="flex justify-between">
          <span>Total Items</span>
          <span>{totals.totalItemsCount}</span>
        </div>

        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>₹{totals.totalBeforeTax.toFixed(2)}</span>
        </div>

        <div className="flex justify-between">
          <span>Tax</span>
          <span>₹{totals.totalTax.toFixed(2)}</span>
        </div>

        <div className="flex justify-between font-bold text-lg border-t pt-2">
          <span>Grand Total</span>
          <span>₹{totals.grandTotal.toFixed(2)}</span>
        </div>

        {/* SUBMIT BUTTON */}
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 mt-4"
        >
          {isSubmitting
            ? mode === "create"
              ? "Creating..."
              : "Updating..."
            : mode === "create"
            ? "Create Bill"
            : "Update Bill"}
        </button>
      </section>
    </div>
  );
}

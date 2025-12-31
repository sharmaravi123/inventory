// src/app/admin/components/returns/AddReturnModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type ReturnCustomerInfo = {
  name: string;
  shopName?: string;
  phone: string;
  address: string;
  gstNumber?: string;
};

type BillItemForReturn = {
  productName: string;
  quantityBoxes: number;
  quantityLoose: number;
  itemsPerBox: number;
  sellingPrice?: number;
  taxPercent?: number;
  warehouseId?: string;
  warehouseName?: string;
};

type BillForReturn = {
  _id: string;
  invoiceNumber: string;
  billDate: string;
  grandTotal: number;
  amountCollected: number;
  balanceAmount: number;
  customerInfo: ReturnCustomerInfo;
  items: BillItemForReturn[];
};

type BillsApiResponse = {
  bills: BillForReturn[];
};

type Warehouse = {
  _id: string;
  name: string;
};

type ReturnDraftItem = {
  billItemIndex: number;
  returnBoxes: number;
  returnLoose: number;
  returnWarehouseId?: string;
};

type AddReturnModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export default function AddReturnModal({
  open,
  onClose,
  onCreated,
}: AddReturnModalProps) {
  const [step, setStep] = useState<1 | 2>(1);

  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [billOptions, setBillOptions] = useState<BillForReturn[]>([]);
  const [selectedBillId, setSelectedBillId] = useState("");

  const [selectedBill, setSelectedBill] = useState<BillForReturn | null>(
    null
  );
  const [draftItems, setDraftItems] = useState<ReturnDraftItem[]>([]);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousesError, setWarehousesError] = useState<string | null>(
    null
  );

  // Reset modal state
  useEffect(() => {
    if (!open) {
      setStep(1);
      setInvoiceSearch("");
      setSearchLoading(false);
      setSearchError(null);
      setBillOptions([]);
      setSelectedBillId("");
      setSelectedBill(null);
      setDraftItems([]);
      setReason("");
      setNote("");
      setSubmitLoading(false);
      setSubmitError(null);
      setWarehousesError(null);
    }
  }, [open]);
 const getPriceWithoutGST = (
  sellingPrice: number,
  taxPercent?: number
): number => {
  if (!taxPercent || taxPercent <= 0) return sellingPrice;
  return sellingPrice / (1 + taxPercent / 100);
};


  // Load warehouses when modal opens (optional)
  useEffect(() => {
    if (!open) return;

    const loadWarehouses = async (): Promise<void> => {
      try {
        setWarehousesError(null);
        const res = await fetch("/api/warehouses");
        if (!res.ok) return;
        const data = (await res.json()) as { warehouses: Warehouse[] };
        setWarehouses(data.warehouses ?? []);
      } catch {
        setWarehousesError("Failed to load warehouses.");
      }
    };

    void loadWarehouses();
  }, [open]);

  const handleSearchInvoice = async (): Promise<void> => {
    const term = invoiceSearch.trim();

    if (!term) {
      setSearchError("Please enter invoice number, customer or phone.");
      return;
    }

    try {
      setSearchLoading(true);
      setSearchError(null);

      const res = await fetch("/api/billing");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to fetch bills");
      }

      const data = (await res.json()) as BillsApiResponse;
      const allBills = data.bills ?? [];

      const lower = term.toLowerCase();
      const filtered = allBills.filter((b) => {
        const text = [
          b.invoiceNumber,
          b.customerInfo.name,
          b.customerInfo.shopName ?? "",
          b.customerInfo.phone,
        ]
          .join(" ")
          .toLowerCase();

        return text.includes(lower);
      });

      setBillOptions(filtered);
      if (filtered.length === 0) {
        setSearchError("No matching invoices found.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to search invoices";
      setSearchError(message);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectBill = (bill: BillForReturn): void => {
    setSelectedBillId(bill._id);
    setSelectedBill(bill);

    const drafts: ReturnDraftItem[] = bill.items.map((item, index) => ({
      billItemIndex: index,
      returnBoxes: 0,
      returnLoose: 0,
      returnWarehouseId: item.warehouseId,
    }));

    setDraftItems(drafts);
    setStep(2);
  };
  const getMaxLooseAllowed = (
    soldBoxes: number,
    soldLoose: number,
    itemsPerBox: number,
    returnBoxes: number
  ): number => {
    const totalSoldItems = soldBoxes * itemsPerBox + soldLoose;
    const itemsUsedByBoxes = returnBoxes * itemsPerBox;
    const remaining = totalSoldItems - itemsUsedByBoxes;
    return Math.max(0, remaining);
  };


  const updateDraftItem = (
    index: number,
    field: "returnBoxes" | "returnLoose" | "returnWarehouseId",
    value: number | string
  ): void => {
    setDraftItems((prev) =>
      prev.map((d, idx) => {
        if (idx !== index) return d;

        const line = selectedBill?.items[d.billItemIndex];
        if (!line) return d;

        const soldBoxes = line.quantityBoxes;
        const soldLoose = line.quantityLoose;
        const itemsPerBox = line.itemsPerBox;

        if (field === "returnBoxes") {
          let boxes = Number(value);
          if (Number.isNaN(boxes)) boxes = 0;

          // ❌ sold boxes se zyada nahi
          boxes = Math.max(0, Math.min(boxes, soldBoxes));

          // boxes badhne par loose auto clamp
          const maxLoose = getMaxLooseAllowed(
            soldBoxes,
            soldLoose,
            itemsPerBox,
            boxes
          );

          return {
            ...d,
            returnBoxes: boxes,
            returnLoose: Math.min(d.returnLoose, maxLoose),
          };
        }

        if (field === "returnLoose") {
          let loose = Number(value);
          if (Number.isNaN(loose)) loose = 0;

          const maxLoose = getMaxLooseAllowed(
            soldBoxes,
            soldLoose,
            itemsPerBox,
            d.returnBoxes
          );

          // ❌ total sold items se zyada nahi
          loose = Math.max(0, Math.min(loose, maxLoose));

          return { ...d, returnLoose: loose };
        }

        return { ...d, returnWarehouseId: value as string };
      })
    );
  };


  const computeItemReturnAmount = (
  bill: BillForReturn,
  draft: ReturnDraftItem
): number => {
  const line = bill.items[draft.billItemIndex];
  if (!line || typeof line.sellingPrice !== "number") return 0;

  const totalItemsReturn =
    draft.returnBoxes * line.itemsPerBox + draft.returnLoose;

  const basePrice = getPriceWithoutGST(
  line.sellingPrice,
  line.taxPercent
);
  console.log({
  sellingPrice: line.sellingPrice,
  taxPercent: line.taxPercent,
  basePrice: getPriceWithoutGST(line.sellingPrice!, line.taxPercent),
});

  return totalItemsReturn * basePrice;
  
};


  const totalReturnAmount = useMemo(() => {
    if (!selectedBill) return 0;
    return draftItems.reduce(
      (sum, d) => sum + computeItemReturnAmount(selectedBill, d),
      0
    );
  }, [draftItems, selectedBill]);

  const totalReturnItems = useMemo(() => {
    if (!selectedBill) return 0;
    return draftItems.reduce((sum, d) => {
      const line = selectedBill.items[d.billItemIndex];
      if (!line) return sum;
      const totalItemsReturn =
        d.returnBoxes * line.itemsPerBox + d.returnLoose;
      return sum + totalItemsReturn;
    }, 0);
  }, [draftItems, selectedBill]);

  const handleSubmit = async (): Promise<void> => {
    if (!selectedBill) return;

    setSubmitError(null);

    const effectiveItems = draftItems.filter(
      (d) => d.returnBoxes > 0 || d.returnLoose > 0
    );

    if (effectiveItems.length === 0) {
      setSubmitError("Please enter return quantity for at least one item.");
      return;
    }

    try {
      setSubmitLoading(true);

      const payload = {
        reason: reason.trim() || undefined,
        note: note.trim() || undefined,
        items: effectiveItems.map((d) => ({
          // 👇 backend snippet ke hisaab se
          itemIndex: d.billItemIndex,
          quantityBoxes: d.returnBoxes,
          quantityLoose: d.returnLoose,
          warehouseId: d.returnWarehouseId,
        })),
      };

      const res = await fetch(`/api/billing/${selectedBill._id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create return");
      }

      onCreated();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create return";
      setSubmitError(message);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (!open) return null;
  

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-[color:var(--color-white)] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[color:var(--color-sidebar)]">
            Add Return
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-2 text-xs"
          >
            ✕
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-slate-500">
              Step 1 – Select invoice for which you want to create a return.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Invoice no / customer / phone"
              />
              <button
                type="button"
                onClick={() => void handleSearchInvoice()}
                disabled={searchLoading}
                className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-xs font-semibold text-[color:var(--color-white)] disabled:opacity-60"
              >
                {searchLoading ? "Searching..." : "Search"}
              </button>
            </div>

            {searchError && (
              <p className="text-xs text-[color:var(--color-error)]">
                {searchError}
              </p>
            )}

            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-[color:var(--color-neutral)]/40">
              {billOptions.length === 0 && !searchLoading && (
                <p className="p-3 text-xs text-slate-500">
                  No invoices loaded. Search to load invoices.
                </p>
              )}

              {billOptions.map((b) => (
                <button
                  key={b._id}
                  type="button"
                  onClick={() => handleSelectBill(b)}
                  className={`flex w-full items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 text-left text-xs hover:bg-[color:var(--color-secondary)]/10 ${selectedBillId === b._id
                    ? "bg-[color:var(--color-secondary)]/20"
                    : ""
                    }`}
                >
                  <div>
                    <p className="font-semibold text-slate-800">
                      {b.invoiceNumber}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {b.customerInfo.name} • {b.customerInfo.phone}
                    </p>
                  </div>
                  <div className="text-right text-[11px]">
                    <p>Grand: ₹{b.grandTotal.toFixed(2)}</p>
                    <p>Paid: ₹{b.amountCollected.toFixed(2)}</p>
                    <p>Bal: ₹{b.balanceAmount.toFixed(2)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && selectedBill && (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-slate-500">
              Step 2 – Enter return quantities and warehouse.
            </p>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <p className="font-semibold text-slate-800">
                {selectedBill.customerInfo.name}{" "}
                {selectedBill.customerInfo.shopName && (
                  <span className="text-[11px] text-slate-600">
                    ({selectedBill.customerInfo.shopName})
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-500">
                Invoice:{" "}
                <span className="font-mono">
                  {selectedBill.invoiceNumber}
                </span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Grand: ₹{selectedBill.grandTotal.toFixed(2)} • Paid: ₹
                {selectedBill.amountCollected.toFixed(2)} • Bal: ₹
                {selectedBill.balanceAmount.toFixed(2)}
              </p>
            </div>

            {warehousesError && (
              <p className="text-xs text-[color:var(--color-error)]">
                {warehousesError}
              </p>
            )}

            <div className="max-h-64 overflow-y-auto">
              <table className="min-w-full border-collapse text-[11px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border-b px-2 py-1 text-left">Item</th>
                    <th className="border-b px-2 py-1 text-right">
                      Sold Boxes
                    </th>
                    <th className="border-b px-2 py-1 text-right">
                      Sold Loose
                    </th>
                    <th className="border-b px-2 py-1 text-right">
                      Return Boxes
                    </th>
                    <th className="border-b px-2 py-1 text-right">
                      Return Loose
                    </th>
                    <th className="border-b px-2 py-1 text-left">
                      Return WH
                    </th>
                    <th className="border-b px-2 py-1 text-right">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {draftItems.map((d, idx) => {
                    const line = selectedBill.items[d.billItemIndex];
                    const amount = computeItemReturnAmount(
                      selectedBill,
                      d
                    );

                    return (
                      <tr key={`${selectedBill._id}-${idx}`}>
                        <td className="border-b px-2 py-1 text-left align-top">
                          <div className="flex flex-col">
                            <span>{line.productName}</span>
                            {line.warehouseName && (
                              <span className="text-[10px] text-slate-500">
                                Bill WH: {line.warehouseName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="border-b px-2 py-1 text-right align-top">
                          {line.quantityBoxes}
                        </td>
                        <td className="border-b px-2 py-1 text-right align-top">
                          {line.quantityLoose}
                        </td>
                        <td className="border-b px-2 py-1 text-right align-top">
                          <input
                            type="number"
                            min={0}
                            value={d.returnBoxes || ""}
                            onChange={(e) =>
                              updateDraftItem(
                                idx,
                                "returnBoxes",
                                e.target.value
                              )
                            }
                            className="w-16 rounded border border-slate-300 px-1 py-0.5 text-right"
                          />
                        </td>
                        <td className="border-b px-2 py-1 text-right align-top">
                          <input
                            type="number"
                            min={0}
                            value={d.returnLoose || ""}
                            onChange={(e) =>
                              updateDraftItem(
                                idx,
                                "returnLoose",
                                e.target.value
                              )
                            }
                            className="w-16 rounded border border-slate-300 px-1 py-0.5 text-right"
                          />
                          <p className="text-[10px] text-slate-500 text-right">
                            Max loose: {
                              getMaxLooseAllowed(
                                line.quantityBoxes,
                                line.quantityLoose,
                                line.itemsPerBox,
                                d.returnBoxes
                              )
                            }
                          </p>
                        </td>
                        <td className="border-b px-2 py-1 text-left align-top">
                          {warehouses.length === 0 ? (
                            <span className="text-[10px] text-slate-500">
                              Same as bill warehouse
                            </span>
                          ) : (
                            <select
                              value={
                                d.returnWarehouseId ??
                                line.warehouseId ??
                                ""
                              }
                              onChange={(e) =>
                                updateDraftItem(
                                  idx,
                                  "returnWarehouseId",
                                  e.target.value
                                )
                              }
                              className="w-32 rounded border border-slate-300 px-1 py-0.5"
                            >
                              <option value="">
                                Select warehouse
                              </option>
                              {warehouses.map((w) => (
                                <option key={w._id} value={w._id}>
                                  {w.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="border-b px-2 py-1 text-right align-top">
                          {amount > 0
                            ? `₹${amount.toFixed(2)}`
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 text-xs">
                <label className="block font-medium">
                  Reason (optional)
                </label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Damaged / expired / customer request..."
                />
                <label className="block font-medium">
                  Note (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-xs">
                <p className="mb-1 font-semibold text-slate-700">
                  Return Summary
                </p>
                <p>Total items: {totalReturnItems}</p>
                <p>
                  Return amount:{" "}
                  <span className="font-semibold text-[color:var(--color-primary)]">
                    ₹{totalReturnAmount.toFixed(2)}
                  </span>
                </p>
                <p className="mt-2 text-[11px] text-slate-500">
                  • Partial payment: outstanding balance will be reduced
                  by return amount.
                  • Fully paid: bill total and collected amount will be
                  reduced by return value (you refund the customer).
                </p>
              </div>
            </div>

            {submitError && (
              <p className="text-xs text-[color:var(--color-error)]">
                {submitError}
              </p>
            )}

            <div className="mt-2 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-full border border-slate-300 px-3 py-1"
              >
                ◀ Change invoice
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-slate-300 px-3 py-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitLoading}
                  className="rounded-full bg-[color:var(--color-primary)] px-4 py-1 text-[11px] font-semibold text-[color:var(--color-white)] disabled:opacity-60"
                >
                  {submitLoading ? "Saving..." : "Save Return"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

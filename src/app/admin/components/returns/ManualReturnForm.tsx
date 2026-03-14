"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/store/store";
import { fetchProducts } from "@/store/productSlice";
import { fetchWarehouses } from "@/store/warehouseSlice";

type ManualReturnFormProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export default function ManualReturnForm({
  open,
  onClose,
  onCreated,
}: ManualReturnFormProps) {
  const dispatch = useDispatch<AppDispatch>();

  /* ---------------- REDUX DATA ---------------- */

  const products = useSelector(
    (state: RootState) => state.product.products
  );

  const warehouses = useSelector(
    (state: RootState) => state.warehouse.list
  );

  /* ---------------- LOCAL STATE ---------------- */

  const [customerName, setCustomerName] = useState("");

  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");

  const [boxes, setBoxes] = useState(0);
  const [loose, setLoose] = useState(0);
  const [rate, setRate] = useState(0);

  const [itemsPerBox, setItemsPerBox] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------------- LOAD DATA ON OPEN ---------------- */

  useEffect(() => {
    if (!open) return;
    dispatch(fetchProducts());
    dispatch(fetchWarehouses());
  }, [open, dispatch]);

  /* ---------------- RESET ON CLOSE ---------------- */

  useEffect(() => {
    if (!open) {
      setCustomerName("");
      setProductId("");
      setWarehouseId("");
      setBoxes(0);
      setLoose(0);
      setRate(0);
      setItemsPerBox(1);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  /* ---------------- DERIVED ---------------- */

  const totalItems = useMemo(
    () => boxes * itemsPerBox + loose,
    [boxes, loose, itemsPerBox]
  );

  const totalAmount = useMemo(
    () => totalItems * rate,
    [totalItems, rate]
  );

  /* ---------------- SUBMIT ---------------- */

  const submit = async (): Promise<void> => {
    if (!customerName.trim()) {
      setError("Customer name is required");
      return;
    }

    if (!productId || !warehouseId) {
      setError("Please select product and store");
      return;
    }

    if (boxes <= 0 && loose <= 0) {
      setError("Enter return quantity");
      return;
    }

    if (rate <= 0) {
      setError("Rate must be greater than 0");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/returns/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          items: [
            {
              productId,
              warehouseId,
              quantityBoxes: boxes,
              quantityLoose: loose,
              itemsPerBox,
              unitPrice: rate,
            },
          ],
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save manual return");
      }

      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  /* ---------------- UI ---------------- */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-[color:var(--color-white)] p-4 shadow-2xl">
        {/* HEADER */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[color:var(--color-sidebar)]">
            Manual Return
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-2 text-xs"
          >
            ✕
          </button>
        </div>

        {/* FORM */}
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs font-medium">Customer Name</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium">Product</label>
              <select
  value={productId}
  onChange={(e) => {
    const id = e.target.value;
    setProductId(id);

    const p = products.find(
      (x) => String(x._id ?? x.id) === id
    );

    // items per box
    setItemsPerBox(
      typeof p?.perBoxItem === "number" && p.perBoxItem > 0
        ? p.perBoxItem
        : 1
    );

    // ✅ AUTO RATE FROM PRODUCT (EDITABLE)
    if (typeof p?.sellingPrice === "number" && p.sellingPrice > 0) {
      setRate(p.sellingPrice);
    }
  }}
  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
>
  <option value="">Select product</option>
  {products.map((p) => (
    <option
      key={String(p._id ?? p.id)}
      value={String(p._id ?? p.id)}
    >
      {p.name}
    </option>
  ))}
</select>

            </div>

            <div>
              <label className="block text-xs font-medium">Store</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">Select store</option>
                {warehouses.map((w) => (
                  <option
                    key={String(w._id ?? w.id)}
                    value={String(w._id ?? w.id)}
                  >
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
  <div>
    <label className="block text-xs font-medium">Boxes</label>
    <input
      type="number"
      value={boxes || ""}
      onChange={(e) => setBoxes(Number(e.target.value) || 0)}
      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-right"
    />
  </div>

  <div>
    <label className="block text-xs font-medium">Loose</label>
    <input
      type="number"
      value={loose || ""}
      onChange={(e) => setLoose(Number(e.target.value) || 0)}
      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-right"
    />
  </div>

  <div>
    <label className="block text-xs font-medium">
      Rate / piece
    </label>
    <input
      type="number"
      value={rate || ""}
      onChange={(e) => setRate(Number(e.target.value) || 0)}
      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-right"
    />
  </div>
</div>


          <div className="rounded-lg bg-slate-50 p-3 text-xs">
            <p>Total items: {totalItems}</p>
            <p className="font-semibold text-[color:var(--color-primary)]">
              Total amount: ₹{totalAmount.toFixed(2)}
            </p>
          </div>

          {error && (
            <p className="text-xs text-[color:var(--color-error)]">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-full border border-slate-300 px-4 py-1 text-xs"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              onClick={() => void submit()}
              className="rounded-full bg-[color:var(--color-primary)] px-4 py-1 text-xs font-semibold text-[color:var(--color-white)] disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save Manual Return"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

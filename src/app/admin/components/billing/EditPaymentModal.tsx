"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Bill,
  PaymentMode,
  CreateBillPaymentInput,
  useUpdateBillPaymentMutation,
} from "@/store/billingApi";
import Swal from "sweetalert2";

type EditPaymentModalProps = {
  bill?: Bill;
  onClose: () => void;
  onUpdated: () => void;
};

type LocalPaymentState = {
  mode: PaymentMode;
  cashAmount: number;
  upiAmount: number;
  cardAmount: number;
};

const num = (v: unknown) =>
  Number.isFinite(Number(v)) ? Number(v) : 0;

export default function EditPaymentModal({
  bill,
  onClose,
  onUpdated,
}: EditPaymentModalProps) {
  const [extraPayment, setExtraPayment] = useState<LocalPaymentState>({
    mode: "CASH",
    cashAmount: 0,
    upiAmount: 0,
    cardAmount: 0,
  });

  const [updatePayment, { isLoading }] =
    useUpdateBillPaymentMutation();

  useEffect(() => {
    if (!bill) return;
    setExtraPayment({
      mode: bill.payment.mode,
      cashAmount: 0,
      upiAmount: 0,
      cardAmount: 0,
    });
  }, [bill]);

  const base = useMemo(() => {
    if (!bill) {
      return { cash: 0, upi: 0, card: 0 };
    }
    return {
      cash: num(bill.payment.cashAmount),
      upi: num(bill.payment.upiAmount),
      card: num(bill.payment.cardAmount),
    };
  }, [bill]);

  const round2 = (n: number) =>
    Math.round((n + Number.EPSILON) * 100) / 100;

  const baseTotal = round2(base.cash + base.upi + base.card);
  const extraTotal = round2(
    extraPayment.cashAmount +
      extraPayment.upiAmount +
      extraPayment.cardAmount
  );

  const grandTotal = bill ? bill.grandTotal : 0;
  const remaining = round2(grandTotal - baseTotal);
  const newPaidTotal = round2(baseTotal + extraTotal);

  const handleSave = async () => {
    if (!bill) return;

    if (extraTotal <= 0) {
      Swal.fire({
        icon: "warning",
        title: "Error",
        text: "Please enter payment amount",
        confirmButtonText: "OK",
      });

      return;
    }

    if (extraTotal - remaining > 0.01) {
      Swal.fire({
        icon: "warning",
        title: "Error",
        text: "Payment cannot exceed remaining balance",
        confirmButtonText: "OK",
      });

      return;
    }

    let cash = base.cash;
    let upi = base.upi;
    let card = base.card;

    if (extraPayment.mode === "CASH") {
      cash += extraPayment.cashAmount;
    } else if (extraPayment.mode === "UPI") {
      upi += extraPayment.upiAmount;
    } else if (extraPayment.mode === "CARD") {
      card += extraPayment.cardAmount;
    } else {
      cash += extraPayment.cashAmount;
      upi += extraPayment.upiAmount;
      card += extraPayment.cardAmount;
    }

    const payload: CreateBillPaymentInput = {
      mode: extraPayment.mode,
      cashAmount: cash,
      upiAmount: upi,
      cardAmount: card,
    };

    try {
      await updatePayment({
        id: bill._id,
        payment: payload,
      }).unwrap();

      onUpdated();
      onClose();
    } catch (err) {
      console.error(err);
      Swal.fire({
  icon: "warning",
  title: "Error",
  text: "Payment update failed",
  confirmButtonText: "OK",
});

    }
  };

  if (!bill) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-[color:var(--color-white)] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Edit Payment – {bill.invoiceNumber}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full border px-2 text-xs"
          >
            ✕
          </button>
        </div>

        <p className="text-xs">
          Grand Total: ₹{grandTotal.toFixed(2)}
        </p>
        <p className="mb-2 text-xs">
          Paid: ₹{baseTotal.toFixed(2)} • Balance: ₹{remaining.toFixed(2)}
        </p>

        <div className="mb-3 flex gap-2 text-xs">
          {(["CASH", "UPI", "CARD", "SPLIT"] as PaymentMode[]).map(
            (m) => (
              <button
                key={m}
                onClick={() =>
                  setExtraPayment((p) => ({ ...p, mode: m }))
                }
                className={`rounded-full border px-3 py-1 ${extraPayment.mode === m
                  ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/10"
                  : ""
                  }`}
              >
                {m}
              </button>
            )
          )}
        </div>

        {(extraPayment.mode === "CASH" ||
          extraPayment.mode === "SPLIT") && (
            <input
              type="number"
              placeholder="Add Cash"
              value={extraPayment.cashAmount || ""}
              onChange={(e) =>
                setExtraPayment((p) => ({
                  ...p,
                  cashAmount: num(e.target.value),
                }))
              }
              className="mb-2 w-full rounded border px-3 py-2"
            />
          )}

        {(extraPayment.mode === "UPI" ||
          extraPayment.mode === "SPLIT") && (
            <input
              type="number"
              placeholder="Add UPI"
              value={extraPayment.upiAmount || ""}
              onChange={(e) =>
                setExtraPayment((p) => ({
                  ...p,
                  upiAmount: num(e.target.value),
                }))
              }
              className="mb-2 w-full rounded border px-3 py-2"
            />
          )}

        {(extraPayment.mode === "CARD" ||
          extraPayment.mode === "SPLIT") && (
            <input
              type="number"
              placeholder="Add Card"
              value={extraPayment.cardAmount || ""}
              onChange={(e) =>
                setExtraPayment((p) => ({
                  ...p,
                  cardAmount: num(e.target.value),
                }))
              }
              className="mb-2 w-full rounded border px-3 py-2"
            />
          )}

        <p className="mt-2 text-xs">
          New Paid: ₹{newPaidTotal.toFixed(2)} • New Balance: ₹
          {round2(grandTotal - newPaidTotal).toFixed(2)}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="rounded bg-[color:var(--color-primary)] px-4 py-1.5 text-white disabled:opacity-60"
          >
            {isLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

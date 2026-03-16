import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import BillModel from "@/models/Bill";
import Stock from "@/models/Stock";
import { Types } from "mongoose";
import { roundGrandTotal } from "@/lib/rounding";

/* ---------------------------------------------
   TYPES
--------------------------------------------- */

type PaymentMode = "CASH" | "UPI" | "CARD" | "SPLIT";

type PaymentInput = {
  mode: PaymentMode;
  cashAmount?: number;
  upiAmount?: number;
  cardAmount?: number;
};

type IncomingItem = {
  stockId: string;
  productId: string;
  warehouseId: string;
  productName: string;
  sellingPrice: number;
  taxPercent: number;
  hsnCode: number;
  quantityBoxes: number;
  quantityLoose: number;
  itemsPerBox: number;
  discountType?: "NONE" | "PERCENT" | "CASH";
  discountValue?: number;
};

type RequestBody = {
  items: IncomingItem[];
  payment: PaymentInput;
  billDate: string;
  roundOff?: number;
};

/* ---------------------------------------------
   HELPERS
--------------------------------------------- */

const toNum = (v: unknown, fb = 0) =>
  Number.isFinite(Number(v)) ? Number(v) : fb;
const round2 = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
const resolveRoundOff = (total: number, roundOffInput?: unknown) => {
  const n = Number(roundOffInput);
  if (Number.isFinite(n)) return round2(n);
  return round2(roundGrandTotal(total) - total);
};

function validatePayment(p: PaymentInput, total: number) {
  const cash = toNum(p.cashAmount);
  const upi = toNum(p.upiAmount);
  const card = toNum(p.cardAmount);
  const collected = round2(cash + upi + card);
  const grand = round2(total);

  if (collected - grand > 0.01) {
    throw new Error("Payment exceeds total");
  }

  return {
    mode: p.mode,
    cashAmount: cash,
    upiAmount: upi,
    cardAmount: card,
  };
}

function calcLine(it: IncomingItem) {
  const qty =
    it.quantityBoxes * it.itemsPerBox + it.quantityLoose;

  const baseTotal = qty * it.sellingPrice;

  let discountAmount = 0;
  if (it.discountType === "PERCENT") {
    discountAmount = (baseTotal * (it.discountValue ?? 0)) / 100;
  } else if (it.discountType === "CASH") {
    discountAmount = it.discountValue ?? 0;
  }

  discountAmount = Math.min(discountAmount, baseTotal);

  const subTotal = Math.max(0, baseTotal - discountAmount);
  const tax = (subTotal * it.taxPercent) / 100;
  const lineTotal = subTotal + tax;

  return {
    billItem: {
      product: new Types.ObjectId(it.productId),
      warehouse: new Types.ObjectId(it.warehouseId),
      productName: it.productName,
      sellingPrice: it.sellingPrice,
      hsnCode: it.hsnCode ?? null,
      taxPercent: it.taxPercent,
      quantityBoxes: it.quantityBoxes,
      quantityLoose: it.quantityLoose,
      itemsPerBox: it.itemsPerBox,
      discountType: it.discountType ?? "NONE",
      discountValue: it.discountValue ?? 0,
      totalItems: qty,
      totalBeforeTax: subTotal,
      taxAmount: tax,
      lineTotal,
      overridePriceForCustomer: false,
    },
    totals: { qty, before: subTotal, tax, gross: lineTotal },
  };
}

/* ---------------------------------------------
   PUT – UPDATE BILL (FIXED)
--------------------------------------------- */

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const body = (await req.json()) as RequestBody;
    const { id } = await context.params;

    const bill = await BillModel.findById(id);
    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    /* ---------------------------------------------
       1️⃣ OLD ITEMS MAP (product+warehouse – unchanged)
    --------------------------------------------- */
    const oldMap = new Map<string, typeof bill.items[number]>();
    for (const it of bill.items) {
      const key = `${it.product}_${it.warehouse}`;
      oldMap.set(key, it);
    }

    /* ---------------------------------------------
       2️⃣ STOCK UPDATE (ONLY FIX HERE)
    --------------------------------------------- */
    for (const newIt of body.items) {
      const key = `${newIt.productId}_${newIt.warehouseId}`;
      const oldIt = oldMap.get(key);

      const perBox = newIt.itemsPerBox || 1;
      const newTotal =
        newIt.quantityBoxes * perBox +
        (newIt.quantityLoose || 0);

      // 🔥 FIX: stockId se hi stock uthao
      const stock = await Stock.findById(newIt.stockId);
      if (!stock) throw new Error("Stock not found");

      const currentTotal =
        stock.boxes * perBox + stock.looseItems;

      if (!oldIt) {
        if (currentTotal < newTotal)
          throw new Error("Insufficient stock");

        const remain = currentTotal - newTotal;
        stock.boxes = Math.floor(remain / perBox);
        stock.looseItems = remain % perBox;
        await stock.save();
        continue;
      }

      const oldTotal =
        oldIt.quantityBoxes * perBox +
        (oldIt.quantityLoose || 0);

      if (oldTotal === newTotal) continue;

      const diff = newTotal - oldTotal;
      const remain = currentTotal - diff;

      if (remain < 0) throw new Error("Insufficient stock");

      stock.boxes = Math.floor(remain / perBox);
      stock.looseItems = remain % perBox;
      await stock.save();
    }

    /* ---------------------------------------------
       3️⃣ RECALCULATE TOTALS (UNCHANGED)
    --------------------------------------------- */
    let totalItems = 0;
    let before = 0;
    let tax = 0;
    let grand = 0;

    const newItems = body.items.map((it) => {
      const { billItem, totals } = calcLine(it);
      totalItems += totals.qty;
      before += totals.before;
      tax += totals.tax;
      grand += totals.gross;
      return billItem;
    });

    const roundOff = resolveRoundOff(grand, body.roundOff);
    const finalGrandTotal = round2(grand + roundOff);
    const pay = validatePayment(body.payment, finalGrandTotal);

    bill.set("items", newItems);
    bill.totalItems = totalItems;
    bill.totalBeforeTax = before;
    bill.totalTax = tax;
    bill.roundOff = roundOff;
    bill.grandTotal = finalGrandTotal;
    bill.payment = pay;

    bill.amountCollected = round2(
      pay.cashAmount + pay.upiAmount + pay.cardAmount
    );

    bill.balanceAmount = Math.max(
      0,
      round2(finalGrandTotal - bill.amountCollected)
    );
    bill.billDate = new Date(body.billDate);
    bill.updatedAt = new Date();
    if (bill.balanceAmount <= 0.01) {
      bill.status = "DELIVERED";
    } else if (bill.amountCollected > 0) {
      bill.status = "PARTIALLY_PAID";
    } else {
      bill.status = "PENDING";
    }

    await bill.save();

    return NextResponse.json({ success: true, bill });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ---------------------------------------------
   GET – FETCH SINGLE BILL
--------------------------------------------- */

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid bill id" }, { status: 400 });
    }

    const bill = await BillModel.findById(id);
    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    return NextResponse.json({ bill });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

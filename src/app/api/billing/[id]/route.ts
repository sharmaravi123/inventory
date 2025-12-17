import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import BillModel from "@/models/Bill";
import Stock from "@/models/Stock";
import { Types } from "mongoose";

/* ---------------------------------------------
   TYPES (STRICT – NO any)
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
};

/* ---------------------------------------------
   HELPERS
--------------------------------------------- */

const toNum = (v: unknown, fb = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

function validatePayment(
  p: PaymentInput,
  total: number
): {
  mode: PaymentMode;
  cashAmount: number;
  upiAmount: number;
  cardAmount: number;
} {
  const cash = toNum(p.cashAmount);
  const upi = toNum(p.upiAmount);
  const card = toNum(p.cardAmount);

  const collected = cash + upi + card;
  if (collected > total) {
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

  // 🔒 SELLING PRICE = INPUT (NEVER MODIFY)
  const sellingPrice = it.sellingPrice;

  const baseTotal = qty * sellingPrice;

  let discountAmount = 0;

  if (it.discountType === "PERCENT") {
    discountAmount = (baseTotal * (it.discountValue ?? 0)) / 100;
  } else if (it.discountType === "CASH") {
    discountAmount = it.discountValue ?? 0;
  }

  // safety
  discountAmount = Math.min(discountAmount, baseTotal);

  const gross = baseTotal - discountAmount;

  const tax = (gross * it.taxPercent) / (100 + it.taxPercent);
  const before = gross - tax;

  return {
    billItem: {
      stock: new Types.ObjectId(it.stockId),
      product: new Types.ObjectId(it.productId),
      warehouse: new Types.ObjectId(it.warehouseId),
      productName: it.productName,

      // ✅ SAVE ORIGINAL PRICE ONLY
      sellingPrice: sellingPrice,

      taxPercent: it.taxPercent,
      quantityBoxes: it.quantityBoxes,
      quantityLoose: it.quantityLoose,
      itemsPerBox: it.itemsPerBox,

      discountType: it.discountType ?? "NONE",
      discountValue: it.discountValue ?? 0,

      totalItems: qty,
      totalBeforeTax: before,
      taxAmount: tax,
      lineTotal: gross,

      overridePriceForCustomer: false,
    },
    totals: { qty, before, tax, gross },
  };
}


/* ---------------------------------------------
   PUT – UPDATE BILL
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
      return NextResponse.json(
        { error: "Bill not found" },
        { status: 404 }
      );
    }

    /* ---------------------------------------------
       1️⃣ BUILD OLD ITEMS MAP
    --------------------------------------------- */
    const oldMap = new Map<string, typeof bill.items[number]>();

    for (const it of bill.items) {
      const pid = String(it.product);
      const wid = String(it.warehouse);
      oldMap.set(`${pid}_${wid}`, it);
    }

    /* ---------------------------------------------
       2️⃣ STOCK UPDATE (DELTA LOGIC)
    --------------------------------------------- */
    for (const newIt of body.items) {
      const pid = String(newIt.productId);
      const wid = String(newIt.warehouseId);
      const key = `${pid}_${wid}`;

      const oldIt = oldMap.get(key);
      const perBox = newIt.itemsPerBox || 1;

      const newTotal =
        newIt.quantityBoxes * perBox +
        (newIt.quantityLoose || 0);

      if (!oldIt) {
        if (newTotal <= 0) continue;

        const stock = await Stock.findOne({
          product: pid,
          warehouse: wid,
        });

        if (!stock) throw new Error("Stock not found");

        const currentTotal =
          stock.boxes * perBox + stock.looseItems;

        if (currentTotal < newTotal) {
          throw new Error("Insufficient stock");
        }

        const updated = currentTotal - newTotal;
        stock.boxes = Math.floor(updated / perBox);
        stock.looseItems = updated % perBox;
        await stock.save();
        continue;
      }

      const oldTotal =
        oldIt.quantityBoxes * perBox +
        (oldIt.quantityLoose || 0);

      if (oldTotal === newTotal) continue;

      const diff = newTotal - oldTotal;

      const stock = await Stock.findOne({
        product: pid,
        warehouse: wid,
      });

      if (!stock) throw new Error("Stock not found");

      const currentTotal =
        stock.boxes * perBox + stock.looseItems;

      const updated = currentTotal - diff;
      if (updated < 0) throw new Error("Insufficient stock");

      stock.boxes = Math.floor(updated / perBox);
      stock.looseItems = updated % perBox;
      await stock.save();
    }

    /* ---------------------------------------------
       3️⃣ RECALCULATE TOTALS
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

    const pay = validatePayment(body.payment, grand);

    /* ✅ Mongoose-safe replacement */
    bill.set("items", newItems);

    bill.totalItems = totalItems;
    bill.totalBeforeTax = before;
    bill.totalTax = tax;
    bill.grandTotal = grand;
    bill.payment = pay;

    bill.amountCollected =
      pay.cashAmount + pay.upiAmount + pay.cardAmount;

    bill.balanceAmount = grand - bill.amountCollected;
    bill.billDate = new Date(body.billDate);
    bill.updatedAt = new Date();

    await bill.save();

    return NextResponse.json({ success: true, bill });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Internal server error";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

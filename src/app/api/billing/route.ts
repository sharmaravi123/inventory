import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import BillModel from "@/models/Bill";
import CustomerModel from "@/models/Customer";
import Stock from "@/models/Stock";
import { Types } from "mongoose";
import { getNextInvoiceNumber } from "@/models/InvoiceCounter";
import { roundGrandTotal } from "@/lib/rounding";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type BillingItemInput = {
  stockId: string;
  productId: string;
  warehouseId: string;
  productName: string;
  sellingPrice: number;
  hsnCode: number;
  taxPercent: number;
  quantityBoxes: number;
  quantityLoose: number;
  itemsPerBox: number;
  discountType: "NONE" | "PERCENT" | "CASH";
  discountValue: number;
  overridePriceForCustomer: boolean;
};

export type CreateBillCustomerInput = {
  _id?: string;
  name: string;
  shopName?: string;
  phone?: string;
  address: string;
  gstNumber?: string;
};

export type CreateBillPaymentInput = {
  mode: "CASH" | "UPI" | "CARD" | "SPLIT";
  cashAmount?: number;
  upiAmount?: number;
  cardAmount?: number;
};

export type CreateBillPayload = {
  customer: CreateBillCustomerInput;
  items: BillingItemInput[];
  payment: CreateBillPaymentInput;
  companyGstNumber?: string;
  billDate?: string;
  roundOff?: number;
};

const toNum = (v: unknown, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const round2 = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
const resolveRoundOff = (total: number, roundOffInput?: unknown) => {
  const n = Number(roundOffInput);
  if (Number.isFinite(n)) return round2(n);
  return round2(roundGrandTotal(total) - total);
};

function validatePayment(
  p: CreateBillPaymentInput | undefined,
  total: number
) {
  const cash = toNum(p?.cashAmount);
  const upi = toNum(p?.upiAmount);
  const card = toNum(p?.cardAmount);

  const collected = round2(cash + upi + card);
  const grand = round2(total);

  if (collected - grand > 0.01) {
    throw new Error("Payment exceeds grand total");
  }

  let mode: CreateBillPaymentInput["mode"] = "CASH";

  if (cash > 0 && upi === 0 && card === 0) mode = "CASH";
  else if (upi > 0 && cash === 0 && card === 0) mode = "UPI";
  else if (card > 0 && cash === 0 && upi === 0) mode = "CARD";
  else if (collected > 0) mode = "SPLIT";

  return {
    mode,
    cashAmount: cash,
    upiAmount: upi,
    cardAmount: card,
  };
}


const normalizePhone = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

async function upsertCustomer(c: CreateBillCustomerInput) {
  const normalizedPhone = normalizePhone(c.phone);
  const update = {
    name: c.name,
    address: c.address,
    shopName: c.shopName,
    gstNumber: c.gstNumber,
    ...(normalizedPhone ? { phone: normalizedPhone } : {}),
  };

  if (c._id && Types.ObjectId.isValid(c._id)) {
    const byId = await CustomerModel.findByIdAndUpdate(
      c._id,
      { $set: update },
      { new: true }
    );
    if (byId) return byId;
  }

  if (normalizedPhone) {
    return CustomerModel.findOneAndUpdate(
      { phone: normalizedPhone },
      { $set: update },
      { new: true, upsert: true }
    );
  }

  // No phone + no valid _id: don't create a customer document.
  return null;
}



function takeSnapshot(
  customerDoc: { _id: string | Types.ObjectId } | null,
  src: CreateBillCustomerInput
) {
  return {
    customer: customerDoc?._id?.toString(),
    name: src.name,
    phone: normalizePhone(src.phone),
    address: src.address,
    shopName: src.shopName,
    gstNumber: src.gstNumber,
  };
}

async function reserveStock(items: BillingItemInput[]) {
  for (const it of items) {
    const stock = await Stock.findById(it.stockId).lean<{
      boxes: number;
      looseItems: number;
      itemsPerBox?: number;
    }>();

    if (!stock) throw new Error("Stock not found");

    const stockItemsPerBox = stock.itemsPerBox ?? it.itemsPerBox ?? 1;

    const available = stock.boxes * stockItemsPerBox + stock.looseItems;
    const req = it.quantityBoxes * stockItemsPerBox + it.quantityLoose;

    if (req > available) throw new Error("Insufficient stock");

    const remain = available - req;
    const newBoxes = Math.floor(remain / stockItemsPerBox);
    const newLoose = remain % stockItemsPerBox;

    await Stock.updateOne(
      { _id: it.stockId },
      { $set: { boxes: newBoxes, looseItems: newLoose } }
    );
  }
}

function calcLine(it: BillingItemInput) {
  const qty = it.quantityBoxes * it.itemsPerBox + it.quantityLoose;

  const baseTotal = qty * it.sellingPrice;
  let discountAmount = 0;
  if (it.discountType === "PERCENT") {
    discountAmount = (baseTotal * it.discountValue) / 100;
  } else if (it.discountType === "CASH") {
    discountAmount = it.discountValue;
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
      discountType: it.discountType,
      discountValue: it.discountValue,
      overridePriceForCustomer: it.overridePriceForCustomer,
      totalItems: qty,
      totalBeforeTax: subTotal,
      taxAmount: tax,
      lineTotal,
    },
    totals: { qty, before: subTotal, tax, gross: lineTotal },
  };
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = (await req.json()) as CreateBillPayload;

    // ✅ ADD THIS BLOCK HERE
    if (!body.customer.name?.trim()) {
      throw new Error("Customer name is required");
    }
    if (!body.customer.address?.trim()) {
      throw new Error("Customer address is required");
    }


    if (!body.items?.length) throw new Error("No items found");

    await reserveStock(body.items);

    let totalItems = 0,
      before = 0,
      tax = 0,
      grand = 0;

    const items = body.items.map((it) => {
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
    const cust = await upsertCustomer(body.customer);

    const overrideItems = body.items.filter((it) => it.overridePriceForCustomer);
    if (cust && overrideItems.length > 0) {
      const uniqueOverrideItems = [
        ...new Map(
          overrideItems.map((it) => [String(it.productId), it])
        ).values(),
      ];

      await CustomerModel.bulkWrite(
        uniqueOverrideItems.flatMap((it) => [
          {
            updateOne: {
              filter: { _id: cust._id },
              update: { $pull: { customPrices: { product: it.productId } } },
            },
          },
          {
            updateOne: {
              filter: { _id: cust._id },
              update: {
                $push: {
                  customPrices: {
                    product: it.productId,
                    price: it.sellingPrice,
                  },
                },
              },
            },
          },
        ])
      );
    }

    const invoice = await getNextInvoiceNumber();

    const collected = round2(
      toNum(pay.cashAmount) + toNum(pay.upiAmount) + toNum(pay.cardAmount)
    );
    const balanceAmount = Math.max(0, round2(finalGrandTotal - collected));

    const bill = await BillModel.create({
      invoiceNumber: invoice,
      billDate: body.billDate ? new Date(body.billDate) : new Date(),
      customerInfo: takeSnapshot(cust, body.customer),
      companyGstNumber: body.companyGstNumber,
      items,
      totalItems,
      totalBeforeTax: before,
      totalTax: tax,
      roundOff,
      grandTotal: finalGrandTotal,
      payment: pay,
      amountCollected: collected,
      balanceAmount,
      status:
        balanceAmount <= 0.01
          ? "DELIVERED"
          : collected > 0
            ? "PARTIALLY_PAID"
            : "PENDING",
    });

    return NextResponse.json({ bill });
  }catch (e: any) {
  console.error("BILL CREATE ERROR:", e);
  return NextResponse.json(
    {
      error: e.message,
      code: e.code,
    },
    { status: 500 }
  );
  }
}

export async function GET() {
  await dbConnect();
  const bills = await BillModel.find()
    .sort({ createdAt: -1 })
    .select(
      "invoiceNumber billDate customerInfo items totalItems totalBeforeTax totalTax roundOff grandTotal payment driver vehicleNumber amountCollected balanceAmount status createdAt"
    )
    .lean();
  return NextResponse.json(
    { bills },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

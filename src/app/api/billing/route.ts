import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import BillModel from "@/models/Bill";
import CustomerModel from "@/models/Customer";
import Stock from "@/models/Stock";
import { Types } from "mongoose";
import { getNextInvoiceNumber } from "@/models/InvoiceCounter";

export type BillingItemInput = {
  stockId: string;
  productId: string;
  warehouseId: string;
  productName: string;
  sellingPrice: number;
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
  phone: string;
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
};

const toNum = (v: unknown, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

// -------------------- PAYMENT VALIDATION --------------------

function validatePayment(p: CreateBillPaymentInput, total: number) {
  const cash = toNum(p.cashAmount);
  const upi = toNum(p.upiAmount);
  const card = toNum(p.cardAmount);
  const collected = cash + upi + card;

  if (collected > total) throw new Error("Payment exceeds grand total");

  return { mode: p.mode, cashAmount: cash, upiAmount: upi, cardAmount: card };
}

// -------------------- CUSTOMER UPSERT --------------------

async function upsertCustomer(c: CreateBillCustomerInput) {
  if (c._id) {
    const doc = await CustomerModel.findById(c._id);
    if (doc) {
      doc.name = c.name;
      doc.phone = c.phone;
      doc.address = c.address;
      doc.shopName = c.shopName;
      doc.gstNumber = c.gstNumber;
      await doc.save();
      return doc;
    }
  }
  return CustomerModel.create(c);
}

// -------------------- FIXED: SNAPSHOT WITHOUT ANY --------------------

function takeSnapshot(
  customerDoc: { _id: string | Types.ObjectId },
  src: CreateBillCustomerInput
) {
  return {
    customer: customerDoc._id.toString(),
    name: src.name,
    phone: src.phone,
    address: src.address,
    shopName: src.shopName,
    gstNumber: src.gstNumber,
  };
}


// -------------------- FIXED: RESERVE STOCK WITHOUT ANY --------------------

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

// -------------------- CALCULATE LINE --------------------

function calcLine(it: BillingItemInput) {
  const qty = it.quantityBoxes * it.itemsPerBox + it.quantityLoose;

  let price = it.sellingPrice;
  if (it.discountType === "PERCENT") price -= (price * it.discountValue) / 100;
  else if (it.discountType === "CASH") price = Math.max(0, price - it.discountValue);

  const gross = qty * price;
  const tax = (gross * it.taxPercent) / (100 + it.taxPercent);
  const before = gross - tax;

  return {
    billItem: {
      product: new Types.ObjectId(it.productId),
      warehouse: new Types.ObjectId(it.warehouseId),
      productName: it.productName,
      sellingPrice: price,
      taxPercent: it.taxPercent,
      quantityBoxes: it.quantityBoxes,
      quantityLoose: it.quantityLoose,
      itemsPerBox: it.itemsPerBox,
      discountType: it.discountType,
      discountValue: it.discountValue,
      overridePriceForCustomer: it.overridePriceForCustomer,
      totalItems: qty,
      totalBeforeTax: before,
      taxAmount: tax,
      lineTotal: gross,
    },
    totals: { qty, before, tax, gross },
  };
}

// -------------------- POST (CREATE BILL) --------------------

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = (await req.json()) as CreateBillPayload;
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

    const pay = validatePayment(body.payment, grand);
    const cust = await upsertCustomer(body.customer);

    // Save customer-specific custom prices
    for (const it of body.items) {
      if (it.overridePriceForCustomer) {
        await CustomerModel.updateOne(
          { _id: cust._id },
          { $pull: { customPrices: { product: it.productId } } }
        );

        await CustomerModel.updateOne(
          { _id: cust._id },
          {
            $push: {
              customPrices: {
                product: it.productId,
                price: it.sellingPrice,
              },
            },
          }
        );
      }
    }

    const invoice = await getNextInvoiceNumber();

    const bill = await BillModel.create({
      invoiceNumber: invoice,
      billDate: body.billDate ? new Date(body.billDate) : new Date(),
      customerInfo: takeSnapshot(cust, body.customer),
      companyGstNumber: body.companyGstNumber,
      items,
      totalItems,
      totalBeforeTax: before,
      totalTax: tax,
      grandTotal: grand,
      payment: pay,
      amountCollected:
        toNum(pay.cashAmount) + toNum(pay.upiAmount) + toNum(pay.cardAmount),
      balanceAmount:
        grand -
        (toNum(pay.cashAmount) +
          toNum(pay.upiAmount) +
          toNum(pay.cardAmount)),
      status:
        grand ===
        (toNum(pay.cashAmount) +
          toNum(pay.upiAmount) +
          toNum(pay.cardAmount))
          ? "DELIVERED"
          : "PENDING",
    });

    return NextResponse.json({ bill });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

// -------------------- GET (LIST BILLS) --------------------

export async function GET() {
  await dbConnect();
  const bills = await BillModel.find().sort({ createdAt: -1 });
  return NextResponse.json({ bills });
}

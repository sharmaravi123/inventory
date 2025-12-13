import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import BillModel from "@/models/Bill";
import CustomerModel from "@/models/Customer";
import { Types } from "mongoose";
import { BillingItemInput, CreateBillPaymentInput } from "../route";

const toNum = (v: unknown, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

function validatePayment(p: CreateBillPaymentInput, total: number) {
  const cash = toNum(p.cashAmount);
  const upi = toNum(p.upiAmount);
  const card = toNum(p.cardAmount);

  if (cash + upi + card > total) throw new Error("Overpaid");

  return { mode: p.mode, cashAmount: cash, upiAmount: upi, cardAmount: card };
}

function calcLine(it: BillingItemInput) {
  const qty = it.quantityBoxes * it.itemsPerBox + it.quantityLoose;

  let price = it.sellingPrice;
  if (it.discountType === "PERCENT") price -= (price * it.discountValue) / 100;
  else if (it.discountType === "CASH") price = Math.max(0, price - it.discountValue);

  const gross = qty * price;
  const tax = (gross * it.taxPercent) / (100 + it.taxPercent);
  const before = gross - tax;

  return {
    item: {
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

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await ctx.params;
  const bill = await BillModel.findById(id);
  if (!bill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ bill });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await ctx.params;

    const bill = await BillModel.findById(id);
    if (!bill) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();

    // update customer
    if (body.customer) {
      bill.customerInfo.name = body.customer.name;
      bill.customerInfo.phone = body.customer.phone;
      bill.customerInfo.address = body.customer.address;
      bill.customerInfo.shopName = body.customer.shopName;
      bill.customerInfo.gstNumber = body.customer.gstNumber;
    }

    if (body.billDate) bill.billDate = new Date(body.billDate);

    if (Array.isArray(body.items)) {
      let totalItems = 0;
      let before = 0;
      let tax = 0;
      let grand = 0;

      const newItems = body.items.map((it: BillingItemInput) => {
        const { item, totals } = calcLine(it);
        totalItems += totals.qty;
        before += totals.before;
        tax += totals.tax;
        grand += totals.gross;

        if (it.overridePriceForCustomer) {
          CustomerModel.updateOne(
            { _id: bill.customerInfo.customer },
            { $pull: { customPrices: { product: it.productId } } }
          ).exec();

          CustomerModel.updateOne(
            { _id: bill.customerInfo.customer },
            {
              $push: {
                customPrices: {
                  product: it.productId,
                  price: it.sellingPrice,
                },
              },
            }
          ).exec();
        }

        return item;
      });

      // FIXED TS ERROR: assign plain array, not DocumentArray
      bill.items = newItems;
      bill.totalItems = totalItems;
      bill.totalBeforeTax = before;
      bill.totalTax = tax;
      bill.grandTotal = grand;
    }

    const grand = bill.grandTotal;

    if (body.payment) {
      const pay = validatePayment(body.payment, grand);
      bill.payment = pay;
      const collected =
        toNum(pay.cashAmount) + toNum(pay.upiAmount) + toNum(pay.cardAmount);
      bill.amountCollected = collected;
      bill.balanceAmount = grand - collected;
    }

    await bill.save();
    return NextResponse.json({ bill });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

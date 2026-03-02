import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import BillModel from "@/models/Bill";

const toNum = (v: unknown, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const round2 = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ✅ FIX
) {
  try {
    await dbConnect();

    const { id } = await params; // ✅ FIX

    const body = await req.json();
    const bill = await BillModel.findById(id);

    if (!bill) {
      return NextResponse.json(
        { error: "Bill not found" },
        { status: 404 }
      );
    }

    const cash = toNum(body.payment?.cashAmount);
    const upi = toNum(body.payment?.upiAmount);
    const card = toNum(body.payment?.cardAmount);

    const collected = round2(cash + upi + card);
    const grandTotal = round2(Number(bill.grandTotal || 0));

    if (collected - grandTotal > 0.01) {
      return NextResponse.json(
        { error: "Payment exceeds grand total" },
        { status: 400 }
      );
    }

    bill.payment = {
      mode: body.payment.mode,
      cashAmount: cash,
      upiAmount: upi,
      cardAmount: card,
    };

    bill.amountCollected = collected;
    bill.balanceAmount = Math.max(
      0,
      round2(grandTotal - collected)
    );
    if (bill.balanceAmount <= 0.01) {
      bill.status = "DELIVERED";
      (bill as typeof bill & { deliveredAt?: Date }).deliveredAt = new Date();
    } else if (collected > 0) {
      bill.status = "PARTIALLY_PAID";
    } else {
      bill.status = "PENDING";
    }
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

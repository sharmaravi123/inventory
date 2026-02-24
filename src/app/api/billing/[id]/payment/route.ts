import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import BillModel from "@/models/Bill";

const toNum = (v: unknown, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

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

    const collected = cash + upi + card;

    if (collected > bill.grandTotal + 0.001) {
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
    bill.balanceAmount = Math.max(0, bill.grandTotal - collected);
    if (bill.balanceAmount <= 0.001) {
      bill.status = "DELIVERED";
      (bill as typeof bill & { deliveredAt?: Date }).deliveredAt = new Date();
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

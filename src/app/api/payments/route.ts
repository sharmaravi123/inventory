import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import Bill from "@/models/Bill";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const { billId, payment } = await req.json();

    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return NextResponse.json(
        { error: "Invalid Bill ID" },
        { status: 400 }
      );
    }

    const bill = await Bill.findById(billId);
    if (!bill) {
      return NextResponse.json(
        { error: "Bill not found" },
        { status: 404 }
      );
    }

    const cash = Number(payment?.cashAmount || 0);
    const upi = Number(payment?.upiAmount || 0);
    const card = Number(payment?.cardAmount || 0);
    const amountCollected = cash + upi + card;
    const balanceAmount = Math.max(0, Number(bill.grandTotal || 0) - amountCollected);

    const payload: Record<string, unknown> = {
      amountCollected,
      balanceAmount,
      payment: {
        mode: String(payment?.mode || bill.payment?.mode || "CASH"),
        cashAmount: cash,
        upiAmount: upi,
        cardAmount: card,
      },
      updatedAt: new Date(),
    };

    if (balanceAmount <= 0.001) {
      payload.status = "DELIVERED";
      payload.deliveredAt = new Date();
    }

    await Bill.findByIdAndUpdate(billId, { $set: payload }, { new: true });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Internal server error";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

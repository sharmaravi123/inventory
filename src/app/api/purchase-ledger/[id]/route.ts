import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import dbConnect from "@/lib/mongodb";
import PurchaseDealerPayment from "@/models/PurchaseDealerPayment";

async function getToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const headerToken = authHeader?.split(" ")[1];
  const cookieStore = await cookies();
  const cookieToken =
    cookieStore.get("adminToken")?.value ??
    cookieStore.get("token")?.value ??
    null;
  return headerToken ?? cookieToken;
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { id } = await context.params;
    const body = await req.json();

    const updates: Record<string, unknown> = {};

    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "amount must be greater than 0" }, { status: 400 });
      }
      updates.amount = amount;
    }

    if (body.paymentDate !== undefined) {
      const paymentDate = new Date(body.paymentDate);
      if (Number.isNaN(paymentDate.getTime())) {
        return NextResponse.json({ error: "valid paymentDate is required" }, { status: 400 });
      }
      updates.paymentDate = paymentDate;
    }

    if (body.paymentMode !== undefined) {
      const paymentMode = String(body.paymentMode || "").toUpperCase();
      if (!["CASH", "UPI", "CARD"].includes(paymentMode)) {
        return NextResponse.json({ error: "paymentMode must be CASH, UPI or CARD" }, { status: 400 });
      }
      updates.paymentMode = paymentMode;
    }

    if (body.note !== undefined) {
      updates.note = String(body.note || "").trim();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await PurchaseDealerPayment.findByIdAndUpdate(id, updates, {
      new: true,
    }).lean();

    if (!updated) {
      return NextResponse.json({ error: "Payment entry not found" }, { status: 404 });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update payment entry";
    console.error("PURCHASE LEDGER UPDATE ERROR:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import dbConnect from "@/lib/mongodb";
import Purchase from "@/models/PurchaseOrder";
import PurchaseDealerPayment from "@/models/PurchaseDealerPayment";
import "@/models/Dealer";

type PurchaseRow = {
  _id: unknown;
  purchaseDate?: Date | null;
  createdAt?: Date | null;
  invoiceNumber?: string;
  purchaseNumber?: string;
  grandTotal?: number;
};

type PaymentDocRow = {
  _id: unknown;
  paymentDate?: Date | null;
  amount?: number;
  paymentMode?: "CASH" | "UPI" | "CARD";
  note?: string;
};

function parseMonthRange(month: string | null) {
  const now = new Date();
  const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const value = month && /^\d{4}-\d{2}$/.test(month) ? month : fallback;
  const [year, monthNum] = value.split("-").map(Number);
  const start = new Date(year, monthNum - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, monthNum, 0, 23, 59, 59, 999);
  return { month: value, start, end };
}

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

export async function GET(req: NextRequest) {
  try {
    const token = await getToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const url = new URL(req.url);
    const dealerId = url.searchParams.get("dealerId");
    if (!dealerId) {
      return NextResponse.json({ error: "dealerId is required" }, { status: 400 });
    }

    const { month, start, end } = parseMonthRange(url.searchParams.get("month"));

    const purchaseDateFilter = {
      $or: [
        { purchaseDate: { $gte: start, $lte: end } },
        { purchaseDate: null, createdAt: { $gte: start, $lte: end } },
      ],
    };

    const [purchasesRaw, paymentsRaw] = await Promise.all([
      Purchase.find({ dealerId, ...purchaseDateFilter })
        .select("invoiceNumber purchaseNumber grandTotal purchaseDate createdAt")
        .sort({ purchaseDate: 1, createdAt: 1 })
        .lean(),
      PurchaseDealerPayment.find({
        dealerId,
        paymentDate: { $gte: start, $lte: end },
      })
        .select("amount paymentMode paymentDate note createdAt")
        .sort({ paymentDate: 1, createdAt: 1 })
        .lean(),
    ]);

    const purchases = (purchasesRaw as PurchaseRow[]).map((p) => ({
      type: "PURCHASE",
      id: String(p._id),
      date: (p.purchaseDate ?? p.createdAt)?.toISOString(),
      invoiceNumber: p.invoiceNumber || p.purchaseNumber || "-",
      amount: Number(p.grandTotal || 0),
    }));

    const payments = (paymentsRaw as PaymentDocRow[]).map((p) => ({
      type: "PAYMENT",
      id: String(p._id),
      date: p.paymentDate?.toISOString(),
      amount: Number(p.amount || 0),
      paymentMode: p.paymentMode || "CASH",
      note: p.note || "",
    }));

    const entries = [...purchases, ...payments].sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return aTime - bTime;
    });

    const totalPurchase = purchases.reduce((sum, row) => sum + row.amount, 0);
    const totalPaid = payments.reduce((sum, row) => sum + row.amount, 0);

    return NextResponse.json(
      {
        month,
        dealerId,
        entries,
        payments,
        summary: {
          totalPurchase,
          totalPaid,
          balance: totalPurchase - totalPaid,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch purchase ledger";
    console.error("PURCHASE LEDGER GET ERROR:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = await getToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const body = await req.json();
    const dealerId = String(body?.dealerId || "");
    const amount = Number(body?.amount || 0);
    const paymentMode = String(body?.paymentMode || "CASH").toUpperCase();
    const paymentDate = body?.paymentDate ? new Date(body.paymentDate) : null;
    const note = String(body?.note || "").trim();

    if (!dealerId) {
      return NextResponse.json({ error: "dealerId is required" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount must be greater than 0" }, { status: 400 });
    }
    if (!paymentDate || Number.isNaN(paymentDate.getTime())) {
      return NextResponse.json({ error: "valid paymentDate is required" }, { status: 400 });
    }
    if (!["CASH", "UPI", "CARD"].includes(paymentMode)) {
      return NextResponse.json({ error: "paymentMode must be CASH, UPI or CARD" }, { status: 400 });
    }

    const created = await PurchaseDealerPayment.create({
      dealerId,
      amount,
      paymentMode,
      paymentDate,
      note,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create payment entry";
    console.error("PURCHASE LEDGER CREATE ERROR:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

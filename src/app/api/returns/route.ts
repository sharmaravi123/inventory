import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";

// 🔴 VERY IMPORTANT — this registers the Bill model
import "@/models/Bill";

import BillReturn, { BillReturnDocument } from "@/models/BillReturn";

/* -------------------- TYPES -------------------- */

type ReturnItemResponse = {
  productName: string;
  quantityBoxes: number;
  quantityLoose: number;
  itemsPerBox: number;
  totalItems: number;
  unitPrice?: number;      // GST INCLUDED
  taxPercent?: number;     // 👈 ADD THIS
  lineAmount?: number;
};

type PopulatedBillLean = {
  _id?: Types.ObjectId;
  invoiceNumber?: string;
} | null;

type BillReturnLean = Omit<BillReturnDocument, "bill"> & {
  _id: Types.ObjectId;
  bill?: PopulatedBillLean;
  createdAt?: Date;
};

type ReturnRecordResponse = {
  _id: string;
  billId?: string;
  invoiceNumber?: string;
  customerInfo: BillReturnDocument["customerInfo"];
  reason?: string;
  note?: string;
  items: ReturnItemResponse[];
  totalAmount?: number;
  createdAt: string;
};

/* -------------------- ROUTE -------------------- */

export async function GET(_req: NextRequest) {
  try {
    await dbConnect();

    const docs = await BillReturn.find({
      $or: [
        { bill: { $ne: null } },
        { bill: null }
      ]
    })
      .populate({
        path: "bill",            // must match schema field
        select: "invoiceNumber",
      })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const returns: ReturnRecordResponse[] = (
      docs as unknown as BillReturnLean[]
    ).map((doc) => {
      const bill = doc.bill;

      return {
        _id: doc._id.toString(),
        billId: bill?._id?.toString() || undefined,
        invoiceNumber: bill?.invoiceNumber,
        customerInfo: doc.customerInfo,
        reason: doc.reason,
        note: doc.note,
        totalAmount: doc.totalAmount,
        createdAt: doc.createdAt
          ? new Date(doc.createdAt).toISOString()
          : new Date().toISOString(),
        items: doc.items.map((it) => ({
          productName: it.productName,
          quantityBoxes: it.quantityBoxes,
          quantityLoose: it.quantityLoose,
          itemsPerBox: it.itemsPerBox,
          totalItems: it.totalItems,
          unitPrice: it.unitPrice,
          lineAmount: it.lineAmount,
          taxPercent: it.taxPercent,
        })),
      };
    });

    return NextResponse.json({ returns });
  } catch (error: unknown) {
    console.error("Returns GET error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

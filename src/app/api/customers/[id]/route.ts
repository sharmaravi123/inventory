import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import CustomerModel, { ensureCustomerPhoneIndex } from "@/models/Customer";
import BillModel from "@/models/Bill";
import { deleteBillAndRestoreStock } from "@/lib/deleteBill";

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    await ensureCustomerPhoneIndex();

    const { id } = await context.params;
    if (!id || !Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
    }

    const deleteBills =
      req.nextUrl.searchParams.get("deleteBills") === "true";

    const customer = await CustomerModel.findById(id).lean();
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    let billsDeleted = 0;

    if (deleteBills) {
      const orFilter: Record<string, unknown>[] = [
        { "customerInfo.customer": new mongoose.Types.ObjectId(id) },
        { "customerInfo.customer": id },
      ];

      const phone = normalizeText(customer.phone);
      if (phone) {
        orFilter.push({ "customerInfo.phone": phone });
      }

      const bills = await BillModel.find({ $or: orFilter })
        .select("_id")
        .lean();

      for (const bill of bills) {
        const ok = await deleteBillAndRestoreStock(bill._id);
        if (ok) billsDeleted += 1;
      }
    }

    await CustomerModel.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      deleteBills,
      billsDeleted,
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Failed to delete customer";
    console.error("CUSTOMER DELETE ERROR:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

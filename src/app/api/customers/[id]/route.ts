import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import CustomerModel, { ensureCustomerPhoneIndex } from "@/models/Customer";
import BillModel from "@/models/Bill";
import { deleteBillAndRestoreStock } from "@/lib/deleteBill";
import { getIndianFinancialYearStartYear } from "@/lib/financialYear";
import { renumberSalesInvoicesForFinancialYear } from "@/lib/salesInvoiceNumber";

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

      const name = normalizeText(customer.name);
      const shopName = normalizeText(customer.shopName);
      if (shopName) {
        orFilter.push({ "customerInfo.shopName": shopName });
      }
      if (name) {
        orFilter.push({ "customerInfo.name": name });
      }

      const bills = await BillModel.find({ $or: orFilter })
        .select("_id billDate createdAt")
        .lean();

      const fysToRenumber = new Set<number>();

      for (const bill of bills) {
        const ok = await deleteBillAndRestoreStock(bill._id, {
          renumberInvoices: false,
        });
        if (ok) {
          billsDeleted += 1;
          fysToRenumber.add(
            getIndianFinancialYearStartYear(
              new Date(bill.billDate || bill.createdAt || Date.now())
            )
          );
        }
      }

      for (const fy of fysToRenumber) {
        await renumberSalesInvoicesForFinancialYear(fy);
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

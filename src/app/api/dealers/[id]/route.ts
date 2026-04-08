import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Dealer from "@/models/Dealer";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await context.params;
    const body = await req.json();

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }

    const updated = await Dealer.findByIdAndUpdate(
      id,
      {
        $set: {
          name,
          phone: typeof body?.phone === "string" ? body.phone.trim() : "",
          address: typeof body?.address === "string" ? body.address.trim() : "",
          gstin: typeof body?.gstin === "string" ? body.gstin.trim() : "",
          fassiNumber: typeof body?.fassiNumber === "string" ? body.fassiNumber.trim() : "",
          isActive: true,
          inactiveAt: null,
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
    }

    return NextResponse.json({ dealer: updated }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to update dealer" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await context.params;

    const updated = await Dealer.findByIdAndUpdate(
      id,
      { $set: { isActive: false, inactiveAt: new Date() } },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to deactivate dealer" }, { status: 500 });
  }
}

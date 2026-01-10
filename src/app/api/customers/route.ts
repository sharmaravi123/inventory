import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import CustomerModel, { CustomerDocument } from "@/models/Customer";

type CustomersResponse = {
  customers: CustomerDocument[];
};

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = await req.json();

    const { name, phone, shopName, address, gstNumber } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Customer name is required" },
        { status: 400 }
      );
    }

    if (!phone?.trim()) {
      return NextResponse.json(
        { error: "Customer phone is required" },
        { status: 400 }
      );
    }

    // 🔁 UPSERT (same logic as billing)
    const customer = await CustomerModel.findOneAndUpdate(
      { phone },
      {
        $set: {
          name,
          phone,
          shopName,
          address,
          gstNumber,
        },
      },
      { new: true, upsert: true }
    );

    return NextResponse.json(
      { customer },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("CUSTOMER CREATE ERROR:", e);
    return NextResponse.json(
      { error: e.message || "Failed to create customer" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest
): Promise<NextResponse<CustomersResponse | { error: string }>> {
  try {
    await dbConnect();

    const searchParams = req.nextUrl.searchParams;
    const q = (searchParams.get("q") ?? "").trim();

    const filter: Record<string, unknown> = {};

    if (q.length > 0) {
      filter["$or"] = [
        { name: { $regex: q, $options: "i" } },
        { shopName: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }

    const customers = await CustomerModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .exec();

    return NextResponse.json({ customers });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

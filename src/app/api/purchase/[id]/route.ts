import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Purchase from "@/models/PurchaseOrder";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Invalid ID" },
        { status: 400 }
      );
    }

    const purchase = await Purchase.findById(id)
      .populate("dealerId", "name phone address gstin")
      .populate("warehouseId", "name")
      .populate("items.productId", "name hsnCode perBoxItem")
      .lean();

    if (!purchase) {
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(purchase, { status: 200 });
  } catch (error: any) {
    console.error("PURCHASE FETCH ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch purchase" },
      { status: 500 }
    );
  }
}


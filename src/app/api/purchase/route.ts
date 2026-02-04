export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Stock from "@/models/Stock";
import Product, { IProduct } from "@/models/Product";
import Purchase from "@/models/PurchaseOrder";
import { cookies } from "next/headers";
/* ================= GET ================= */
export async function GET() {
  try {
    await dbConnect();
    const cookieStore = await cookies();
    const token = cookieStore.get("adminToken")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const purchases = await Purchase.find()
      .populate("dealerId", "name phone address gstin")
      .populate("items.productId", "name perBoxItem")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(purchases);
  } catch (err: any) {
    // log to platform log (Vercel dashboard)
    console.error("ERROR GET /api/purchase:", err);
    // return error details temporarily (remove in prod!)
    return NextResponse.json({ error: err?.message || "Unknown", stack: err?.stack }, { status: 500 });
  }
}



/* ================= POST ================= */
export async function POST(req: NextRequest) {
  await dbConnect();

  const { dealerId, warehouseId, items, purchaseDate  } = await req.json();

  let subTotal = 0;
  let taxTotal = 0;

  const computedItems = [];

  for (const item of items) {
    /* 🔥 PRODUCT FETCH */
    const product = (await Product.findById(item.productId)
      .lean()
      .exec()) as IProduct | null;

    if (!product) continue;

    const perBox =
      typeof product.perBoxItem === "number" && product.perBoxItem > 0
        ? product.perBoxItem
        : 1;

    const totalQty =
      item.boxes * perBox + item.looseItems;

    const baseAmount =
      totalQty * item.purchasePrice;

    const taxAmount =
      (baseAmount * item.taxPercent) / 100;

    const totalAmount = baseAmount + taxAmount;

    subTotal += baseAmount;
    taxTotal += taxAmount;

    /* ✅ PUSH FINAL ITEM (WITH PRODUCT SNAPSHOT) */
    computedItems.push({
      productId: item.productId,
      boxes: item.boxes,
      looseItems: item.looseItems,
      perBoxItem: perBox,
      purchasePrice: item.purchasePrice,
      taxPercent: item.taxPercent,
      taxAmount,
      totalAmount,
      totalQty,
    });

    /* 🔥 INVENTORY UPDATE */
    const stock = await Stock.findOne({
      productId: item.productId,
      warehouseId,
    });

    if (stock) {
      stock.boxes += item.boxes;
      stock.looseItems += item.looseItems;
      stock.totalItems =
        stock.boxes * perBox + stock.looseItems;
      await stock.save();
    } else {
      await Stock.create({
        productId: item.productId,
        warehouseId,
        boxes: item.boxes,
        looseItems: item.looseItems,
        totalItems: totalQty,
      });
    }
  }

  /* ✅ CREATE PURCHASE */
  const purchase = await Purchase.create({
    dealerId,
    warehouseId,
    items: computedItems,
    subTotal,
    taxTotal,
    grandTotal: subTotal + taxTotal,
     createdAt: purchaseDate ? new Date(purchaseDate) : new Date(),
  });

  /* 🔥 RETURN POPULATED DATA */
  const populated = await Purchase.findById(purchase._id)
    .populate("dealerId", "name phone")
    .populate("items.productId", "name")
    .lean();

  return NextResponse.json(populated, { status: 201 });
}

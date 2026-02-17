export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Stock from "@/models/Stock";
import Product from "@/models/Product";
import Purchase from "@/models/PurchaseOrder";
import "@/models/Dealer";
import "@/models/Warehouse";
import { cookies } from "next/headers";

/* ================= GET ================= */
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const authHeader = req.headers.get("authorization");
    const headerToken = authHeader?.split(" ")[1];
    const cookieStore = await cookies();
    const cookieToken =
      cookieStore.get("adminToken")?.value ??
      cookieStore.get("token")?.value ??
      null;
    const token = headerToken ?? cookieToken;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const purchases = await Purchase.find()
      .select("dealerId warehouseId items subTotal taxTotal grandTotal purchaseDate createdAt")
      .populate("dealerId", "name phone address gstin")
      .populate("items.productId", "name perBoxItem")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(purchases);
  } catch (err: any) {
    console.error("GET PURCHASE ERROR:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}




/* ================= POST ================= */
export async function POST(req: NextRequest) {
  await dbConnect();

  const { dealerId, warehouseId, items, purchaseDate } = await req.json();
  const uniqueProductIds = [
    ...new Set(
      (Array.isArray(items) ? items : [])
        .map((it: { productId?: string }) => String(it?.productId || ""))
        .filter(Boolean)
    ),
  ];
  const products = await Product.find({ _id: { $in: uniqueProductIds } })
    .select("_id perBoxItem")
    .lean();
  const productMap = new Map(
    products.map((p) => [String((p as { _id: unknown })._id), p])
  );

  let subTotal = 0;
  let taxTotal = 0;

  const computedItems = [];

  for (const item of items) {
    /* 🔥 PRODUCT FETCH */
    const product = productMap.get(String(item.productId)) as
      | { perBoxItem?: number }
      | undefined;

    if (!product) continue;

    const perBox =
      typeof product.perBoxItem === "number" && product.perBoxItem > 0
        ? product.perBoxItem
        : 1;

    const totalQty =
      item.boxes * perBox + item.looseItems;

    const grossAmount = totalQty * Number(item.purchasePrice || 0);
    const discountPercent = Math.max(
      0,
      Math.min(100, Number(item.discountPercent || 0))
    );
    const discountAmount = (grossAmount * discountPercent) / 100;
    const taxableAmount = grossAmount - discountAmount;
    const taxAmount = (taxableAmount * Number(item.taxPercent || 0)) / 100;
    const totalAmount = taxableAmount + taxAmount;

    subTotal += taxableAmount;
    taxTotal += taxAmount;

    /* ✅ PUSH FINAL ITEM (WITH PRODUCT SNAPSHOT) */
    computedItems.push({
      productId: item.productId,
      boxes: item.boxes,
      looseItems: item.looseItems,
      perBoxItem: perBox,
      purchasePrice: item.purchasePrice,
      discountPercent,
      grossAmount,
      discountAmount,
      taxableAmount,
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
    purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
  });

  /* 🔥 RETURN POPULATED DATA */
  const populated = await Purchase.findById(purchase._id)
    .populate("dealerId", "name phone")
    .populate("items.productId", "name")
    .lean();

  return NextResponse.json(populated, { status: 201 });
}

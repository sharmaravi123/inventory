// src/app/api/stocks/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Stock from "@/models/Stock";
import type { IStock } from "@/models/Stock";

type GetQuery = { productId?: string | null; warehouseId?: string | null };

function normalizeNumbers(n: unknown, fallback = 0): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");
    const warehouseId = url.searchParams.get("warehouseId");

    const filter: Partial<Record<"productId" | "warehouseId", string>> = {};
    if (productId) filter.productId = productId;
    if (warehouseId) filter.warehouseId = warehouseId;

    const stocks = await Stock.find(filter).sort({ createdAt: -1 }).lean().exec();
    return NextResponse.json({ stocks }, { status: 200 });
  } catch (err) {
    console.error("GET /api/stocks error:", err);
    return NextResponse.json({ error: "Failed to fetch stocks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    // NOTE: auth removed per request. To re-enable, call verifyTokenFromReq(req) and check roles.

    const body = await req.json();

    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    const warehouseId = typeof body.warehouseId === "string" ? body.warehouseId.trim() : "";

    if (!productId || !warehouseId) {
      return NextResponse.json({ error: "productId and warehouseId are required (string IDs expected)" }, { status: 400 });
    }

    // parse numeric fields safely
    let boxes = normalizeNumbers(body.boxes, 0);
    const itemsPerBox = Math.max(1, normalizeNumbers(body.itemsPerBox, 1));
    let looseItems = Math.max(0, normalizeNumbers(body.looseItems, 0));
    const lowStockItems = body.lowStockItems === undefined ? null : normalizeNumbers(body.lowStockItems, 0);
    const lowStockBoxes = body.lowStockBoxes === undefined ? null : normalizeNumbers(body.lowStockBoxes, 0);
    const tax = normalizeNumbers(body.tax, 0);

    // Convert looseItems into boxes if they overflow itemsPerBox
    if (itemsPerBox > 0 && looseItems >= itemsPerBox) {
      const extraBoxes = Math.floor(looseItems / itemsPerBox);
      boxes += extraBoxes;
      looseItems = looseItems % itemsPerBox;
    }

    // uniqueness check
    const existing = await Stock.findOne({ productId, warehouseId }).exec();
    if (existing) {
      return NextResponse.json({ error: "Stock for this product and warehouse already exists" }, { status: 409 });
    }

    const totalItems = boxes * itemsPerBox + looseItems;

    const toCreate: Partial<IStock> = {
      productId,
      warehouseId,
      boxes,
      itemsPerBox,
      looseItems,
      totalItems,
      lowStockItems,
      lowStockBoxes,
      tax,
    };

    const created = await Stock.create(toCreate);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("POST /api/stocks error:", err);
    const message = err instanceof Error ? err.message : "Failed to create stock";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

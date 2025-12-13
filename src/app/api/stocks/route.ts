import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Stock from "@/models/Stock";
import type { IStock } from "@/models/Stock";
import Product, { IProduct } from "@/models/Product";

function normalizeNumber(n: unknown, fallback = 0): number {
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

    const stocks = await Stock.find(filter)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return NextResponse.json({ stocks }, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("GET /api/stocks error:", err);
    return NextResponse.json(
      { error: "Failed to fetch stocks" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = await req.json();

    const productId =
      typeof body.productId === "string" ? body.productId.trim() : "";
    const warehouseId =
      typeof body.warehouseId === "string" ? body.warehouseId.trim() : "";

    if (!productId || !warehouseId) {
      return NextResponse.json(
        {
          error:
            "productId and warehouseId are required (string IDs expected)",
        },
        { status: 400 }
      );
    }

    // product se perBoxItem lo
    const product = (await Product.findById(productId)
      .lean()
      .exec()) as IProduct | null;

    const perBoxItemFromProduct =
      product && typeof (product as { perBoxItem?: unknown }).perBoxItem === "number"
        ? (product as { perBoxItem: number }).perBoxItem
        : 1;

    const perBox = perBoxItemFromProduct > 0 ? perBoxItemFromProduct : 1;

    let boxes = normalizeNumber(body.boxes, 0);
    let looseItems = Math.max(
      0,
      normalizeNumber(body.looseItems, 0)
    );

    const lowStockItems =
      body.lowStockItems === undefined
        ? null
        : normalizeNumber(body.lowStockItems, 0);
    const lowStockBoxes =
      body.lowStockBoxes === undefined
        ? null
        : normalizeNumber(body.lowStockBoxes, 0);

    // loose → boxes normalise, product ke perBoxItem se
    if (perBox > 0 && looseItems >= perBox) {
      const extraBoxes = Math.floor(looseItems / perBox);
      boxes += extraBoxes;
      looseItems = looseItems % perBox;
    }

    const existing = await Stock.findOne({ productId, warehouseId }).exec();
    if (existing) {
      return NextResponse.json(
        { error: "Stock for this product and warehouse already exists" },
        { status: 409 }
      );
    }

    const totalItems = boxes * perBox + looseItems;

    const payload: Partial<IStock> = {
      productId,
      warehouseId,
      boxes,
      looseItems,
      totalItems,
      lowStockItems,
      lowStockBoxes,
    };

    const created = await Stock.create(payload);

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /api/stocks error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to create stock";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

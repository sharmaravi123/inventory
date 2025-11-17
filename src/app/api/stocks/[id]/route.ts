// src/app/api/stocks/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Stock from "@/models/Stock"; // Mongoose model
import type { IStock } from "@/models/Stock";

type RouteCtx<T extends Record<string, string>> = { params: T } | { params: Promise<T> };

function normalizeNumbers(n: unknown, fallback = 0): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export async function GET(req: NextRequest, context: RouteCtx<{ id: string }>) {
  const params = await context.params;
  const id = params.id;
  try {
    await dbConnect();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const stock = await Stock.findById(id).lean().exec();
    if (!stock) return NextResponse.json({ error: "Stock not found" }, { status: 404 });
    return NextResponse.json(stock, { status: 200 });
  } catch (err) {
    console.error("GET /api/stocks/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch stock" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteCtx<{ id: string }>) {
  const params = await context.params;
  const id = params.id;
  try {
    await dbConnect();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = await req.json();
    // allow partial update of quantities only — productId/warehouseId are immutable
    const { boxes, itemsPerBox, looseItems, lowStockItems, lowStockBoxes } = body;

    const stock = await Stock.findById(id).exec();
    if (!stock) return NextResponse.json({ error: "Stock not found" }, { status: 404 });

    const newItemsPerBox = itemsPerBox !== undefined ? Math.max(1, normalizeNumbers(itemsPerBox, stock.itemsPerBox)) : stock.itemsPerBox;
    let newBoxes = boxes !== undefined ? normalizeNumbers(boxes, stock.boxes) : stock.boxes;
    let newLoose = looseItems !== undefined ? Math.max(0, normalizeNumbers(looseItems, stock.looseItems)) : stock.looseItems;
    const tax = body.tax;

    // normalize loose -> boxes if overflow
    if (newItemsPerBox > 0 && newLoose >= newItemsPerBox) {
      const extra = Math.floor(newLoose / newItemsPerBox);
      newBoxes += extra;
      newLoose = newLoose % newItemsPerBox;
    }

    const totalItems = newBoxes * newItemsPerBox + newLoose;

    stock.boxes = newBoxes;
    stock.itemsPerBox = newItemsPerBox;
    stock.looseItems = newLoose;
    stock.totalItems = totalItems;
    stock.lowStockItems = lowStockItems !== undefined ? normalizeNumbers(lowStockItems, 0) : stock.lowStockItems;
    stock.lowStockBoxes = lowStockBoxes !== undefined ? normalizeNumbers(lowStockBoxes, 0) : stock.lowStockBoxes;
    stock.tax = tax !== undefined ? normalizeNumbers(tax, 0) : stock.tax;

    await stock.save();
    return NextResponse.json(stock, { status: 200 });
  } catch (err) {
    console.error("PUT /api/stocks/[id] error:", err);
    return NextResponse.json({ error: "Failed to update stock" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteCtx<{ id: string }>) {
  const params = await context.params;
  const id = params.id;
  try {
    await dbConnect();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const deleted = await Stock.findByIdAndDelete(id).exec();
    if (!deleted) return NextResponse.json({ error: "Stock not found" }, { status: 404 });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/stocks/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete stock" }, { status: 500 });
  }
}

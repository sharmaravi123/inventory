import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Purchase from "@/models/PurchaseOrder";
import "@/models/Dealer";
import "@/models/Warehouse";
import "@/models/Product";
import Product from "@/models/Product";
import Stock from "@/models/Stock";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const { id } = await context.params;

    const purchase = await Purchase.findById(id)
      .select("dealerId warehouseId items subTotal taxTotal grandTotal purchaseDate createdAt")
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
  } catch (error) {
    console.error("PURCHASE FETCH ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const { id } = await context.params;
    const { dealerId, warehouseId, items, purchaseDate } =
      await req.json();

    if (!dealerId || !warehouseId || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    const existing = await Purchase.findById(id).lean();
    if (!existing) {
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 }
      );
    }

    const oldItems = Array.isArray(existing.items) ? existing.items : [];
    const allProductIds = [
      ...new Set(
        [
          ...oldItems.map((it: { productId?: unknown }) =>
            String(it?.productId || "")
          ),
          ...items.map((it: { productId?: string }) =>
            String(it?.productId || "")
          ),
        ].filter(Boolean)
      ),
    ];
    const products = await Product.find({ _id: { $in: allProductIds } })
      .select("_id perBoxItem")
      .lean();
    const productMap = new Map(
      products.map((p) => [String((p as { _id: unknown })._id), p])
    );

    // Revert old stock
    for (const oldItem of oldItems) {
      const oldItemAny = oldItem as {
        productId?: unknown;
        boxes?: number;
        looseItems?: number;
        perBoxItem?: number;
      };
      const productId = String(oldItemAny.productId);
      const oldWarehouseId = String(existing.warehouseId);
      const product = productMap.get(productId) as
        | { perBoxItem?: number }
        | undefined;
      const perBox =
        typeof oldItemAny.perBoxItem === "number" &&
        oldItemAny.perBoxItem > 0
          ? oldItemAny.perBoxItem
          : product?.perBoxItem ?? 1;

      const stock = await Stock.findOne({
        productId,
        warehouseId: oldWarehouseId,
      });

      if (!stock) {
        // If stock record is missing, skip revert to avoid hard-fail.
        continue;
      }

      let newBoxes = stock.boxes - (oldItemAny.boxes ?? 0);
      let newLoose = stock.looseItems - (oldItemAny.looseItems ?? 0);

      if (newBoxes < 0) newBoxes = 0;
      if (newLoose < 0) newLoose = 0;

      stock.boxes = newBoxes;
      stock.looseItems = newLoose;
      stock.totalItems = newBoxes * perBox + newLoose;
      await stock.save();
    }

    // Build new computed items + apply stock
    let subTotal = 0;
    let taxTotal = 0;
    const computedItems = [];

    for (const item of items) {
      const product = productMap.get(String(item.productId)) as
        | { perBoxItem?: number }
        | undefined;

      if (!product) {
        throw new Error("Product not found");
      }

      const perBox =
        typeof product.perBoxItem === "number" &&
        product.perBoxItem > 0
          ? product.perBoxItem
          : 1;

      const totalQty = item.boxes * perBox + item.looseItems;
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

      const stock = await Stock.findOne({
        productId: item.productId,
        warehouseId,
      });

      if (stock) {
        stock.boxes += item.boxes;
        stock.looseItems += item.looseItems;
        stock.totalItems = stock.boxes * perBox + stock.looseItems;
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

    const updated = await Purchase.findByIdAndUpdate(
      id,
      {
        dealerId,
        warehouseId,
        items: computedItems,
        subTotal,
        taxTotal,
        grandTotal: subTotal + taxTotal,
        purchaseDate: purchaseDate
          ? new Date(purchaseDate)
          : existing.purchaseDate ?? existing.createdAt,
      },
      { new: true }
    )
      .populate("dealerId", "name phone address gstin")
      .populate("warehouseId", "name")
      .populate("items.productId", "name hsnCode perBoxItem")
      .lean();

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error("PURCHASE UPDATE ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update purchase" },
      { status: 500 }
    );
  }
}

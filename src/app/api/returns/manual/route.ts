import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";

import BillReturn from "@/models/BillReturn";
import Stock from "@/models/Stock";
import Product from "@/models/Product";

type ManualReturnItemInput = {
  productId: string;
  warehouseId: string;
  quantityBoxes: number;
  quantityLoose: number;
  itemsPerBox: number;
  unitPrice: number;
};

type ManualReturnBody = {
  customerName: string;
  phone?: string;
  reason?: string;
  note?: string;
  items: ManualReturnItemInput[];
};

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = (await req.json()) as ManualReturnBody;

    if (
      !body.customerName ||
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return NextResponse.json(
        { error: "Invalid manual return data" },
        { status: 400 }
      );
    }

    let totalAmount = 0;
    const returnItems = [];

    for (const it of body.items) {
      const boxes = Math.max(0, it.quantityBoxes);
      const loose = Math.max(0, it.quantityLoose);

      const totalItems = boxes * it.itemsPerBox + loose;
      if (totalItems <= 0) continue;

      const getPriceWithoutGST = (sellingPrice: number, taxPercent?: number): number => {
        return sellingPrice / (1 + (taxPercent || 0) / 100);
      };

      const baseUnitPrice = getPriceWithoutGST(it.unitPrice, 0);
      const lineAmount = baseUnitPrice * totalItems;
      totalAmount += lineAmount;
      const product = await Product.findById(it.productId).select("name");

      if (!product) {
        return NextResponse.json(
          { error: "Product not found" },
          { status: 400 }
        );
      }

      returnItems.push({
        product: new Types.ObjectId(it.productId),
        warehouse: new Types.ObjectId(it.warehouseId),
        productName: product.name, // ✅ REQUIRED FIELD
        quantityBoxes: boxes,
        quantityLoose: loose,
        itemsPerBox: it.itemsPerBox,
        totalItems,
        unitPrice: baseUnitPrice,
        lineAmount,
        taxPercent: 0,
      });


      // ---------- INVENTORY UPDATE ----------
      const stock = await Stock.findOne({
        productId: it.productId,
        warehouseId: it.warehouseId,
      });

      if (!stock) {
        await Stock.create({
          productId: it.productId,
          warehouseId: it.warehouseId,
          boxes,
          looseItems: loose,
          itemsPerBox: it.itemsPerBox,
        });
      } else {
        const currentTotal =
          stock.boxes * it.itemsPerBox + (stock.looseItems ?? 0);

        const newTotal = currentTotal + totalItems;

        stock.boxes = Math.floor(newTotal / it.itemsPerBox);
        stock.looseItems = newTotal % it.itemsPerBox;

        await stock.save();
      }
    }

    if (returnItems.length === 0) {
      return NextResponse.json(
        { error: "No valid return items" },
        { status: 400 }
      );
    }

    const doc = await BillReturn.create({
      bill: null,
      customerInfo: {
        name: body.customerName,
        phone: body.phone ?? "",
        address: "",
      },
      reason: body.reason,
      note: body.note,
      items: returnItems,
      totalAmount,
    });

    // ✅ SAFE RESPONSE
    return NextResponse.json({ ok: true, id: doc.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

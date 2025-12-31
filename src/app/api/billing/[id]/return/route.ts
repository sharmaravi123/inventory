import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import BillModel from "@/models/Bill";
import BillReturn, { BillReturnItem } from "@/models/BillReturn";
import Stock from "@/models/Stock";

type ReturnItemByIndex = {
  itemIndex: number;
  quantityBoxes: number;
  quantityLoose: number;
};

type ReturnItemByIds = {
  productId: string;
  warehouseId: string;
  quantityBoxes: number;
  quantityLoose: number;
};

type ReturnItemInput = ReturnItemByIndex | ReturnItemByIds;

type CreateReturnBody = {
  reason?: string;
  note?: string;
  items: ReturnItemInput[];
};

type ReturnResponseBody = {
  ok: true;
  billId: string;
  refundAmount: number;
};

// helper type to read optional fields from Stock without any
type StockLooseFields = {
  itemsPerBox?: number;
  looseItems?: number;
  loose?: number;
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse<ReturnResponseBody | { error: string }>> {
  try {
    await dbConnect();

    const { id: billId } = await context.params;

    const bill = await BillModel.findById(billId).exec();
    if (!bill) {
      return NextResponse.json(
        { error: "Bill not found" },
        { status: 404 }
      );
    }

    if (!bill.items || bill.items.length === 0) {
      return NextResponse.json(
        { error: "Bill has no items" },
        { status: 400 }
      );
    }

    const body = (await req.json()) as CreateReturnBody;
    const getPriceWithoutGST = (sellingPrice: number, taxPercent?: number): number => {
      const tax = taxPercent || 0;
      return sellingPrice / (1 + tax / 100);
    };
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "No return items provided" },
        { status: 400 }
      );
    }

    const returnItems: BillReturnItem[] = [];
    let totalReturnAmount = 0;

    // ---------- PER RETURN LINE ----------
    for (const raw of body.items) {
      // raw is ReturnItemInput (both variants have quantityBoxes/quantityLoose)
      const boxes = Number.isFinite(Number(raw.quantityBoxes))
        ? raw.quantityBoxes
        : 0;
      const loose = Number.isFinite(Number(raw.quantityLoose))
        ? raw.quantityLoose
        : 0;

      // na boxes na loose => skip
      if (boxes <= 0 && loose <= 0) continue;

      // ----- Bill item resolve (index ya id se) -----
      let billItemIndex = -1;

      if ("itemIndex" in raw) {
        billItemIndex = raw.itemIndex;
      } else if ("productId" in raw && "warehouseId" in raw) {
        billItemIndex = bill.items.findIndex(
          (it) =>
            it.product.toString() === raw.productId &&
            it.warehouse.toString() === raw.warehouseId
        );
      }

      if (billItemIndex < 0 || billItemIndex >= bill.items.length) {
        return NextResponse.json(
          { error: "Bill item not found for given input" },
          { status: 400 }
        );
      }

      const billItem = bill.items[billItemIndex];

      const itemsPerBox = billItem.itemsPerBox;
      const requestedPieces = boxes * itemsPerBox + loose;

      if (requestedPieces <= 0) continue;

      // sold pieces (is line se kitna becha tha)
      const soldTotal = billItem.totalItems;

      // safety: ek single return me sold se zyada mat allow karo
      const safeTotalPieces =
        requestedPieces > soldTotal ? soldTotal : requestedPieces;

      const baseUnitPrice = getPriceWithoutGST(
        billItem.sellingPrice,
        billItem.taxPercent
      );
      const lineAmount = baseUnitPrice * safeTotalPieces;

      totalReturnAmount += lineAmount;

      const returnItem: BillReturnItem = {
        product: billItem.product as Types.ObjectId,
        warehouse: billItem.warehouse as Types.ObjectId,
        productName: billItem.productName,
        quantityBoxes: boxes,
        quantityLoose: loose,
        itemsPerBox,
        totalItems: safeTotalPieces,
        unitPrice: baseUnitPrice,
        taxPercent: billItem.taxPercent || 0,
        lineAmount,
      };

      returnItems.push(returnItem);

      // ---------- STOCK UPDATE (same warehouse) ----------
      const stock = await Stock.findOne({
        $or: [
          {
            product: billItem.product,
            warehouse: billItem.warehouse,
          },
          {
            productId: billItem.product,
            warehouseId: billItem.warehouse,
          },
        ],
      }).exec();

      if (!stock) {
        // agar stock na mile to skip, lekin pura request fail nahi kar rahe
        console.warn(
          "Return: Stock not found for bill item",
          billItem.product.toString(),
          billItem.warehouse.toString()
        );
        continue;
      }

      const stockLoose = stock as unknown as StockLooseFields;

      const itemsPerBoxStock =
        typeof stockLoose.itemsPerBox === "number"
          ? stockLoose.itemsPerBox
          : itemsPerBox;

      const currentLoose =
        typeof stockLoose.looseItems === "number"
          ? stockLoose.looseItems
          : typeof stockLoose.loose === "number"
            ? stockLoose.loose
            : 0;

      const currentLooseEq =
        stock.boxes * itemsPerBoxStock + currentLoose;

      const newLooseEq = currentLooseEq + safeTotalPieces;

      const newBoxes = Math.floor(newLooseEq / itemsPerBoxStock);
      const newLoose = newLooseEq % itemsPerBoxStock;

      stock.boxes = newBoxes;

      if (typeof stockLoose.looseItems === "number") {
        stockLoose.looseItems = newLoose;
      }

      if (typeof stockLoose.loose === "number") {
        stockLoose.loose = newLoose;
      }

      await stock.save();
    }

    if (returnItems.length === 0) {
      return NextResponse.json(
        { error: "No valid return items" },
        { status: 400 }
      );
    }

    // ---------- PAYMENT + BILL TOTAL ADJUST ----------
    const oldGrandTotal = bill.grandTotal;
    const oldCollected =
      typeof bill.amountCollected === "number"
        ? bill.amountCollected
        : 0;

    let newGrandTotal = oldGrandTotal - totalReturnAmount;
    if (newGrandTotal < 0) newGrandTotal = 0;

    const refundAmount =
      oldCollected > newGrandTotal
        ? oldCollected - newGrandTotal
        : 0;

    const newCollected = oldCollected - refundAmount;
    const newBalance = newGrandTotal - newCollected;

    bill.grandTotal = newGrandTotal;
    bill.amountCollected = newCollected;
    bill.balanceAmount = newBalance;

    if (newBalance <= 0) {
      bill.status = "DELIVERED";
    } else if (newCollected > 0) {
      bill.status = "PARTIALLY_PAID";
    } else {
      bill.status = "PENDING";
    }

    await bill.save({ validateBeforeSave: false });

    // ---------- SAVE RETURN HISTORY ----------
    const returnDoc = new BillReturn({
      bill: bill._id,
      customerInfo: bill.customerInfo,
      reason: body.reason,
      note: body.note,
      items: returnItems,
      totalAmount: totalReturnAmount,
      invoiceNumber: bill.invoiceNumber,
    });

    await returnDoc.save();

    return NextResponse.json({
      ok: true,
      billId: bill._id.toString(),
      refundAmount,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Billing RETURN POST error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

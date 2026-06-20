import BillModel from "@/models/Bill";
import BillReturn from "@/models/BillReturn";
import Stock from "@/models/Stock";
import { Types } from "mongoose";

/** Deletes one bill, restores stock, removes linked returns. Returns false if bill not found. */
export async function deleteBillAndRestoreStock(
  billId: string | Types.ObjectId
): Promise<boolean> {
  const bill = await BillModel.findById(billId).exec();
  if (!bill) return false;

  for (const line of bill.items) {
    const productId = String(line.product);
    const warehouseId = String(line.warehouse);
    const perBox = Math.max(1, Number(line.itemsPerBox) || 1);
    const addPieces =
      Number(line.quantityBoxes || 0) * perBox +
      Number(line.quantityLoose || 0);

    if (addPieces <= 0) continue;

    const stock = await Stock.findOne({ productId, warehouseId }).exec();
    if (!stock) continue;

    const current =
      Number(stock.boxes || 0) * perBox + Number(stock.looseItems || 0);
    const newTotal = current + addPieces;
    stock.boxes = Math.floor(newTotal / perBox);
    stock.looseItems = newTotal % perBox;
    stock.totalItems = newTotal;
    await stock.save();
  }

  await BillReturn.deleteMany({ bill: bill._id });
  await bill.deleteOne();
  return true;
}

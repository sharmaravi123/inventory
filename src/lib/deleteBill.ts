import BillModel from "@/models/Bill";
import BillReturn from "@/models/BillReturn";
import Stock from "@/models/Stock";
import { getIndianFinancialYearStartYear } from "@/lib/financialYear";
import { renumberSalesInvoicesForFinancialYear } from "@/lib/salesInvoiceNumber";
import { Types } from "mongoose";

export type DeleteBillOptions = {
  /** Renumber remaining bills in the same FY after delete (default true). */
  renumberInvoices?: boolean;
};

/** Deletes one bill, restores stock, removes linked returns. Returns false if bill not found. */
export async function deleteBillAndRestoreStock(
  billId: string | Types.ObjectId,
  options: DeleteBillOptions = {}
): Promise<boolean> {
  const { renumberInvoices = true } = options;
  const bill = await BillModel.findById(billId).exec();
  if (!bill) return false;

  const fy = getIndianFinancialYearStartYear(
    new Date(bill.billDate || bill.createdAt || Date.now())
  );

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

  if (renumberInvoices) {
    await renumberSalesInvoicesForFinancialYear(fy);
  }

  return true;
}

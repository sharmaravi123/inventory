import { Types } from "mongoose";
import Product from "@/models/Product";
import Stock from "@/models/Stock";
import BillModel from "@/models/Bill";
import Purchase from "@/models/PurchaseOrder";

function isEmptyStock(stock: {
  boxes?: number | null;
  looseItems?: number | null;
  totalItems?: number | null;
}) {
  return (
    Number(stock.boxes ?? 0) <= 0 &&
    Number(stock.looseItems ?? 0) <= 0 &&
    Number(stock.totalItems ?? 0) <= 0
  );
}

/** Drop a stock row only when the product was deleted and quantity is zero. */
export async function removeStockIfDeletedProductEmpty(stockId: unknown) {
  if (!stockId) return;
  const stock = await Stock.findById(stockId).select(
    "productId boxes looseItems totalItems"
  );
  if (!stock || !isEmptyStock(stock)) return;

  const product = await Product.exists({ _id: stock.productId });
  if (product) return;

  await Stock.deleteOne({ _id: stock._id });
}

/** Remove every zero-qty stock row whose product no longer exists. */
export async function removeEmptyStocksForDeletedProducts() {
  const empty = await Stock.find({
    totalItems: { $lte: 0 },
    boxes: { $lte: 0 },
    looseItems: { $lte: 0 },
  }).select("_id productId");

  if (!empty.length) return;

  const productIds = [
    ...new Set(empty.map((s) => String(s.productId)).filter(Boolean)),
  ];
  const existing = await Product.find({ _id: { $in: productIds } })
    .select("_id")
    .lean();
  const existingIds = new Set(existing.map((p) => String(p._id)));
  const toDelete = empty
    .filter((s) => !existingIds.has(String(s.productId)))
    .map((s) => s._id);

  if (toDelete.length) {
    await Stock.deleteMany({ _id: { $in: toDelete } });
  }
}

type HistoryItem = {
  product?: unknown;
  productId?: unknown;
  productName?: string;
  sellingPrice?: number;
  purchasePrice?: number;
  taxPercent?: number;
  itemsPerBox?: number;
  perBoxItem?: number;
};

function impliedPerBox(stock: {
  boxes?: number | null;
  looseItems?: number | null;
  totalItems?: number | null;
}) {
  const boxes = Number(stock.boxes ?? 0);
  const loose = Number(stock.looseItems ?? 0);
  const total = Number(stock.totalItems ?? 0);
  if (boxes <= 0 || total < loose) return null;
  const rest = total - loose;
  if (rest % boxes !== 0) return null;
  const perBox = rest / boxes;
  return perBox > 0 ? perBox : null;
}

/** Keep name and prices on stock after the product document is deleted. */
export async function fillDeletedProductStockDetails() {
  const stocks = await Stock.find({
    $or: [
      { productName: null },
      { productName: "" },
      { productName: { $exists: false } },
    ],
  }).select("_id productId boxes looseItems totalItems");

  if (!stocks.length) return;

  const productIds = [
    ...new Set(stocks.map((s) => String(s.productId)).filter(Boolean)),
  ];
  const existing = await Product.find({ _id: { $in: productIds } })
    .select("_id")
    .lean();
  const existingIds = new Set(existing.map((p) => String(p._id)));
  const missing = stocks.filter(
    (s) => s.productId && !existingIds.has(String(s.productId))
  );
  if (!missing.length) return;

  const missingIds = missing.map((stock) => String(stock.productId));
  const productQueryIds = [
    ...missingIds,
    ...missingIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id)),
  ];

  const [bills, purchases] = await Promise.all([
    BillModel.find({ "items.product": { $in: productQueryIds } })
      .sort({ billDate: -1 })
      .select("items")
      .lean(),
    Purchase.find({ "items.productId": { $in: missingIds } })
      .sort({ purchaseDate: -1, createdAt: -1 })
      .select("items")
      .lean(),
  ]);

  const latestBillItem = new Map<string, HistoryItem>();
  for (const bill of bills) {
    for (const item of (bill.items ?? []) as HistoryItem[]) {
      const key = String(item.product ?? "");
      if (key && !latestBillItem.has(key)) latestBillItem.set(key, item);
    }
  }

  const latestPurchaseItem = new Map<string, HistoryItem>();
  for (const purchase of purchases) {
    for (const item of (purchase.items ?? []) as HistoryItem[]) {
      const key = String(item.productId ?? "");
      if (key && !latestPurchaseItem.has(key)) latestPurchaseItem.set(key, item);
    }
  }

  const updates: {
    updateOne: {
      filter: { _id: unknown };
      update: { $set: Record<string, unknown> };
    };
  }[] = [];

  for (const stock of missing) {
    const pid = String(stock.productId);
    const billItem = latestBillItem.get(pid);
    const purchaseItem = latestPurchaseItem.get(pid);
    const perBox =
      (typeof purchaseItem?.perBoxItem === "number" && purchaseItem.perBoxItem > 0
        ? purchaseItem.perBoxItem
        : undefined) ??
      (typeof billItem?.itemsPerBox === "number" && billItem.itemsPerBox > 0
        ? billItem.itemsPerBox
        : undefined) ??
      impliedPerBox(stock);

    if (!billItem?.productName && perBox == null && !purchaseItem) continue;

    updates.push({
      updateOne: {
        filter: { _id: stock._id },
        update: {
          $set: {
            productName: billItem?.productName ?? null,
            purchasePrice:
              typeof purchaseItem?.purchasePrice === "number"
                ? purchaseItem.purchasePrice
                : null,
            sellingPrice:
              typeof billItem?.sellingPrice === "number"
                ? billItem.sellingPrice
                : null,
            perBoxItem: perBox,
            taxPercent:
              typeof purchaseItem?.taxPercent === "number"
                ? purchaseItem.taxPercent
                : typeof billItem?.taxPercent === "number"
                  ? billItem.taxPercent
                  : null,
          },
        },
      },
    });
  }

  if (updates.length) {
    await Stock.collection.bulkWrite(updates);
  }
}

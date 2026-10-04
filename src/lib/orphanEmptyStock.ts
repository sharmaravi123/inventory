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

  for (const stock of missing) {
    const pid = String(stock.productId);
    const bill = await BillModel.findOne({ "items.product": pid })
      .sort({ billDate: -1 })
      .select("items")
      .lean();
    const purchase = await Purchase.findOne({ "items.productId": pid })
      .sort({ purchaseDate: -1, createdAt: -1 })
      .select("items")
      .lean();

    const billItem = ((bill?.items ?? []) as HistoryItem[]).find(
      (item) => String(item.product) === pid
    );
    const purchaseItem = ((purchase?.items ?? []) as HistoryItem[]).find(
      (item) => String(item.productId) === pid
    );
    const perBox =
      (typeof purchaseItem?.perBoxItem === "number" && purchaseItem.perBoxItem > 0
        ? purchaseItem.perBoxItem
        : undefined) ??
      (typeof billItem?.itemsPerBox === "number" && billItem.itemsPerBox > 0
        ? billItem.itemsPerBox
        : undefined) ??
      impliedPerBox(stock);

    if (!billItem?.productName && perBox == null && !purchaseItem) continue;

    await Stock.collection.updateOne(
      { _id: stock._id },
      {
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
      }
    );
  }
}

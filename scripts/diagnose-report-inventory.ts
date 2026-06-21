/**
 * Compare report totals vs inventory valuation; find pricing anomalies.
 * Run: npx tsx scripts/diagnose-report-inventory.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { normalizeInventoryUnitPrices } from "../src/lib/inventoryPricing";

function loadEnvLocal(): void {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const toNum = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const yearStart = new Date(new Date().getFullYear(), 0, 1);
const yearEnd = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59, 999);

function inYear(d: unknown) {
  if (!d) return false;
  const dt = new Date(String(d));
  return !Number.isNaN(dt.getTime()) && dt >= yearStart && dt <= yearEnd;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  const products = await db.collection("products").find({}).toArray();
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const stocks = await db.collection("stocks").find({}).toArray();
  const bills = await db.collection("bills").find({}).toArray();
  const purchases = await db.collection("purchases").find({}).toArray();
  const returns = await db.collection("billreturns").find({}).toArray();

  let stockPurchase = 0;
  let stockSelling = 0;
  let stockItems = 0;
  const anomalies: string[] = [];

  for (const s of stocks) {
    const pid = String(s.productId ?? s.product?._id ?? "");
    const product = productMap.get(pid);
    const perBox =
      toNum(product?.perBoxItem) > 0 ? toNum(product?.perBoxItem) : 1;
    const totalItems =
      typeof s.totalItems === "number"
        ? s.totalItems
        : toNum(s.boxes) * perBox + toNum(s.looseItems);

    const prices = normalizeInventoryUnitPrices(product ?? {});
    const pPurchase = toNum(prices.purchase);
    const pSelling = toNum(prices.selling);

    stockItems += totalItems;
    stockPurchase += totalItems * pPurchase;
    stockSelling += totalItems * pSelling;

    if (product && pPurchase > 0 && pSelling > 0 && pPurchase > pSelling * 3) {
      anomalies.push(
        `${product.name}: purchase/piece=${pPurchase}, selling/piece=${pSelling}, perBox=${perBox}, raw purchasePrice=${product.purchasePrice}, sellingPrice=${product.sellingPrice}`
      );
    }

    // Box-rate not normalized?
    const rawPurchase = toNum(product?.purchasePrice);
    const rawSelling = toNum(product?.sellingPrice ?? product?.price);
    if (
      product &&
      perBox > 1 &&
      rawPurchase > rawSelling &&
      rawPurchase <= rawSelling * perBox * 2
    ) {
      anomalies.push(
        `[maybe box rate] ${product.name}: rawPurchase=${rawPurchase}, rawSelling=${rawSelling}, perBox=${perBox}, normalized purchase=${pPurchase}`
      );
    }
  }

  const yearBills = bills.filter((b) => inYear(b.billDate));
  const grossSales = yearBills.reduce((s, b) => s + toNum(b.grandTotal), 0);

  const yearPurchases = purchases.filter((p) =>
    inYear(p.purchaseDate ?? p.createdAt)
  );
  const totalPurchase = yearPurchases.reduce(
    (s, p) => s + toNum(p.grandTotal),
    0
  );

  const yearReturns = returns.filter((r) => inYear(r.createdAt));
  const returnAmount = yearReturns.reduce(
    (s, r) => s + toNum(r.totalAmount),
    0
  );

  // Bills linked to returns - check double count
  let billsWithReturns = 0;
  let sumOriginalEstimate = 0;
  for (const r of yearReturns) {
    if (r.bill) billsWithReturns += 1;
    sumOriginalEstimate += toNum(r.totalAmount);
  }

  console.log("\n=== STOCK VALUATION (current inventory) ===");
  console.log("Items:", stockItems.toLocaleString("en-IN"));
  console.log("Purchase value:", stockPurchase.toFixed(2));
  console.log("Selling value:", stockSelling.toFixed(2));

  console.log("\n=== REPORTS (current year) ===");
  console.log("Bills:", yearBills.length);
  console.log("Gross sales (sum grandTotal):", grossSales.toFixed(2));
  console.log("Returns in year:", yearReturns.length, "amount:", returnAmount.toFixed(2));
  console.log("Net if subtract returns again:", (grossSales - returnAmount).toFixed(2));
  console.log("Purchases:", yearPurchases.length);
  console.log("Total purchase:", totalPurchase.toFixed(2));

  console.log("\n=== RECONCILIATION ===");
  console.log(
    "Purchase spend - stock purchase value =",
    (totalPurchase - stockPurchase).toFixed(2),
    "(sold/consumed + price diff)"
  );
  console.log(
    "Stock selling value - actual sales =",
    (stockSelling - grossSales).toFixed(2),
    "(unsold stock potential vs sold)"
  );

  // Sales from bill items vs grandTotal
  let itemLineTotal = 0;
  for (const b of yearBills) {
    for (const it of b.items ?? []) {
      itemLineTotal += toNum(it.lineTotal);
    }
  }
  console.log("\nSum of bill line totals:", itemLineTotal.toFixed(2));
  console.log("Sum of grandTotals:", grossSales.toFixed(2));

  // Purchase items qty vs stock
  let purchasedQty = 0;
  for (const p of yearPurchases) {
    for (const it of p.items ?? []) {
      const perBox = toNum(it.perBoxItem) || 1;
      purchasedQty +=
        toNum(it.totalQty) ||
        toNum(it.boxes) * perBox + toNum(it.looseItems);
    }
  }
  console.log("\nPurchased qty (year):", purchasedQty.toLocaleString("en-IN"));
  console.log("Current stock qty:", stockItems.toLocaleString("en-IN"));
  console.log("Sold qty (year bills):", yearBills.reduce((s, b) => s + toNum(b.totalItems), 0).toLocaleString("en-IN"));

  if (anomalies.length) {
    console.log("\n=== PRICING ANOMALIES (first 15) ===");
    anomalies.slice(0, 15).forEach((a) => console.log(a));
    console.log(`... ${anomalies.length} total`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);

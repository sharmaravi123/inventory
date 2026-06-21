/**
 * Diagnose Ajay Tea Stall bill grouping (INV-000032 vs INV-000005)
 * Run: npx tsx scripts/diagnose-ajay-bills.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";

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

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing");

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error("No db");

  const invoices = ["INV-2026-000032", "INV-2026-000005", "INV-2026-000054"];
  const bills = await db
    .collection("bills")
    .find({ invoiceNumber: { $in: invoices } })
    .toArray();

  console.log("\n=== BILLS FOUND ===", bills.length);
  for (const b of bills) {
    console.log(JSON.stringify({
      invoice: b.invoiceNumber,
      billDate: b.billDate,
      customerInfo: b.customerInfo,
      grandTotal: b.grandTotal,
    }, null, 2));
  }

  const ajayShop = await db.collection("bills").find({
    $or: [
      { "customerInfo.shopName": /ajay tea stall/i },
      { "customerInfo.name": /ajay tea stall/i },
    ],
  }).project({ invoiceNumber: 1, customerInfo: 1, grandTotal: 1 }).toArray();

  console.log("\n=== ALL AJAY TEA STALL BILLS ===", ajayShop.length);
  for (const b of ajayShop) {
    console.log(b.invoiceNumber, JSON.stringify(b.customerInfo));
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

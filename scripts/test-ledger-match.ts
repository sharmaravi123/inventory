/**
 * Test ledger matching for shop:ajay tea stall
 * Run: npx tsx scripts/test-ledger-match.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import {
  buildExpandedLedgerBillQuery,
  buildLedgerBillQuery,
  filterLedgerBillsWithAliases,
  resolveLedgerCustomerKey,
} from "../src/lib/customerLedgerMatch";

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

async function runCase(
  db: NonNullable<typeof mongoose.connection.db>,
  label: string,
  decodedKey: string
) {
  console.log(`\n========== ${label} (${decodedKey}) ==========`);
  const billQuery = buildLedgerBillQuery(decodedKey);
  let rawBills = await db.collection("bills").find(billQuery).toArray();
  console.log("Initial bills:", rawBills.map((b) => b.invoiceNumber));

  const customers = await db.collection("customers").find({}).toArray();
  const customerRows = customers.map((c) => ({
    _id: String(c._id),
    name: c.name as string,
    shopName: c.shopName as string,
    phone: c.phone as string,
  }));

  const resolvedKey = resolveLedgerCustomerKey(decodedKey, customerRows, rawBills as never[]);
  if (resolvedKey !== decodedKey) {
    console.log("Resolved key:", resolvedKey);
    decodedKey = resolvedKey;
    rawBills = await db.collection("bills").find(buildLedgerBillQuery(decodedKey)).toArray();
    console.log("Re-query bills:", rawBills.map((b) => b.invoiceNumber));
  }

  const expandedQuery = buildExpandedLedgerBillQuery(decodedKey, rawBills as never[]);
  const expandedBills = await db.collection("bills").find(expandedQuery).toArray();
  console.log("Expanded bills:", expandedBills.map((b) => b.invoiceNumber));

  const byId = new Map<string, unknown>();
  for (const bill of [...rawBills, ...expandedBills]) {
    byId.set(String(bill._id), bill);
  }
  rawBills = Array.from(byId.values()) as typeof rawBills;

  const filtered = filterLedgerBillsWithAliases(
    decodedKey,
    rawBills as never[],
    customerRows
  );

  console.log("After alias filter:", filtered.map((b: { invoiceNumber: string }) => b.invoiceNumber));
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  await runCase(db, "Shop key", "shop:ajay tea stall");
  await runCase(db, "Broken phone key", "phone:0");
  await runCase(db, "Mongo id in phone field", "phone:69dfccb9e90b7671feddb4f6");
  await runCase(db, "Jay Veeru shop key", "shop:jay veeru dhaba");
  await runCase(db, "Jay Veeru phone key", "phone:6261844279");

  await mongoose.disconnect();
}

main().catch(console.error);

/**
 * Diagnose Jay Veeru Dhaba bill grouping
 * Run: npx tsx scripts/diagnose-jay-veeru.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import {
  buildBillAwareAliasMap,
  resolveCustomerCanonicalKey,
  shopCanonicalKey,
  phoneCanonicalKey,
} from "../src/lib/customerIdentity";
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

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  const phone = "6261844279";

  console.log("\n=== CUSTOMERS matching Jay / phone ===");
  const customers = await db.collection("customers").find({
    $or: [
      { phone },
      { shopName: /jay veeru/i },
      { name: /jay veeru/i },
    ],
  }).toArray();
  console.log(JSON.stringify(customers, null, 2));

  console.log("\n=== BILLS matching Jay Veeru / phone ===");
  const bills = await db.collection("bills").find({
    $or: [
      { "customerInfo.phone": phone },
      { "customerInfo.shopName": /jay veeru/i },
      { "customerInfo.name": /jay veeru/i },
    ],
  }).toArray();

  for (const b of bills) {
    console.log(JSON.stringify({
      invoice: b.invoiceNumber,
      billDate: b.billDate,
      grandTotal: b.grandTotal,
      customerInfo: b.customerInfo,
    }, null, 2));
  }

  const allCustomers = (await db.collection("customers").find({}).toArray()).map((c) => ({
    _id: String(c._id),
    name: c.name as string,
    shopName: c.shopName as string,
    phone: c.phone as string,
  }));

  const allBills = await db.collection("bills").find({}).toArray();
  const aliases = buildBillAwareAliasMap(allCustomers, allBills);

  console.log("\n=== CANONICAL KEYS ===");
  for (const b of bills) {
    const info = b.customerInfo || {};
    const canonical = resolveCustomerCanonicalKey(info, aliases);
    console.log(b.invoiceNumber, "->", canonical, "| shop:", JSON.stringify(info.shopName), "| phone:", info.phone);
  }

  const keysToTest = [
    phoneCanonicalKey(phone),
    shopCanonicalKey("Jay Veeru Dhaba"),
    `phone:${phone}`,
    "shop:jay veeru dhaba",
  ];

  for (const key of keysToTest) {
    console.log(`\n========== LEDGER TEST: ${key} ==========`);
    let decodedKey = key;
    let rawBills = await db.collection("bills").find(buildLedgerBillQuery(decodedKey)).toArray();
    console.log("Initial:", rawBills.map((b) => b.invoiceNumber));

    const resolved = resolveLedgerCustomerKey(decodedKey, allCustomers, rawBills as never[]);
    if (resolved !== decodedKey) {
      decodedKey = resolved;
      rawBills = await db.collection("bills").find(buildLedgerBillQuery(decodedKey)).toArray();
      console.log("Resolved:", decodedKey, "->", rawBills.map((b) => b.invoiceNumber));
    }

    const expanded = await db.collection("bills").find(buildExpandedLedgerBillQuery(decodedKey, rawBills as never[])).toArray();
    const byId = new Map<string, unknown>();
    for (const b of [...rawBills, ...expanded]) byId.set(String(b._id), b);
    rawBills = Array.from(byId.values()) as typeof rawBills;

    const filtered = filterLedgerBillsWithAliases(decodedKey, rawBills as never[], allCustomers);
    console.log("After filter:", filtered.map((b: { invoiceNumber: string }) => b.invoiceNumber));
  }

  await mongoose.disconnect();
}

main().catch(console.error);

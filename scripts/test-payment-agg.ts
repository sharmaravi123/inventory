/**
 * Test payment page aggregation for Ajay Tea Stall
 * Run: npx tsx scripts/test-payment-agg.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import {
  buildBillAwareAliasMap,
  findDbCustomerIdForCanonical,
  getBillPhone,
  getCustomerCanonicalKey,
  normalizeCustomerText,
  resolveCustomerCanonicalKey,
} from "../src/lib/customerIdentity";
import {
  dropEmptyDuplicatePaymentRows,
  mergePaymentCustomerEntries,
} from "../src/lib/mergePaymentCustomers";

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

const getBillDue = (bill: { balanceAmount?: unknown }) =>
  Number(bill.balanceAmount) || 0;
const getBillPaid = (bill: { amountCollected?: unknown }) =>
  Number(bill.amountCollected) || 0;
const isWithinRange = () => true;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  const bills = await db.collection("bills").find({}).toArray();
  const customers = await db.collection("customers").find({}).toArray();
  const allCustomers = customers.map((c) => ({
    _id: String(c._id),
    name: c.name as string,
    shopName: c.shopName as string,
    phone: c.phone as string,
  }));

  const aliases = buildBillAwareAliasMap(allCustomers, bills, {});

  const ajayBills = bills.filter((b) =>
    /ajay tea stall/i.test(String(b.customerInfo?.shopName || ""))
  );

  console.log("\n=== AJAY BILLS canonical keys ===");
  for (const b of ajayBills) {
    const info = b.customerInfo || {};
    const canonical = resolveCustomerCanonicalKey(info, aliases);
    console.log(b.invoiceNumber, "->", canonical, "| phone:", info.phone);
  }

  type CustomerAgg = {
    customerId: string;
    dbId?: string;
    name: string;
    shopName?: string;
    phone: string;
    bills: typeof bills;
    totalOrders: number;
    totalBilled: number;
    totalPaid: number;
    totalDue: number;
    periodOrders: number;
    periodBilled: number;
    periodPaid: number;
    periodDue: number;
    lastBillDate: string | null;
  };

  const map = new Map<string, CustomerAgg>();
  const emptyStats = {
    totalOrders: 0,
    totalBilled: 0,
    totalPaid: 0,
    totalDue: 0,
    periodOrders: 0,
    periodBilled: 0,
    periodPaid: 0,
    periodDue: 0,
    lastBillDate: null as string | null,
  };

  const ensureEntry = (canonical: string, seed?: Partial<CustomerAgg>) => {
    if (!map.has(canonical)) {
      map.set(canonical, {
        customerId: canonical,
        name: seed?.name || "Unknown",
        shopName: seed?.shopName || "",
        phone: seed?.phone || "-",
        bills: [],
        ...emptyStats,
        ...seed,
      });
    }
    return map.get(canonical)!;
  };

  for (const bill of bills) {
    const info = bill.customerInfo || {};
    const canonical = resolveCustomerCanonicalKey(info, aliases);
    if (canonical === "unknown") continue;
    const entry = ensureEntry(canonical, {
      dbId: findDbCustomerIdForCanonical(canonical, allCustomers),
      name: info.name || "Unknown",
      shopName: info.shopName || "",
      phone: getBillPhone(info) || "-",
    });
    entry.bills.push(bill);
  }

  let arr = dropEmptyDuplicatePaymentRows(
    mergePaymentCustomerEntries(Array.from(map.values()), allCustomers, {
      getBillDue,
      getBillPaid,
      isWithinRange,
    })
  );

  const ajay = arr.filter(
    (c) =>
      (c.shopName || "").toLowerCase().includes("ajay") ||
      c.customerId.includes("ajay")
  );

  console.log("\n=== MERGED AJAY ROWS ===");
  for (const c of ajay) {
    console.log({
      customerId: c.customerId,
      shopName: c.shopName,
      phone: c.phone,
      billCount: c.bills.length,
      invoices: c.bills.map((b) => b.invoiceNumber),
    });
  }

  await mongoose.disconnect();
}

main().catch(console.error);

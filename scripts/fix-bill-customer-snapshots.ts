/**
 * Repair bad customerInfo on bills (trim names, fix phone "0" / mongo id in phone field).
 *
 * Dry run (default): npx tsx scripts/fix-bill-customer-snapshots.ts
 * Apply changes:     npx tsx scripts/fix-bill-customer-snapshots.ts --apply
 * Single shop:       npx tsx scripts/fix-bill-customer-snapshots.ts --apply --shop "Ajay Tea Stall"
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { getBillPhone, isValidCustomerRef, toRefString } from "../src/lib/customerIdentity";

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

const apply = process.argv.includes("--apply");
const shopArgIdx = process.argv.indexOf("--shop");
const shopFilter =
  shopArgIdx >= 0 ? process.argv[shopArgIdx + 1]?.trim() : "";

type BillDoc = {
  _id: unknown;
  invoiceNumber?: string;
  customerInfo?: {
    customer?: unknown;
    name?: string;
    shopName?: string;
    phone?: string;
    address?: string;
    gstNumber?: string;
  };
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing");

  await mongoose.connect(uri);
  const db = mongoose.connection.db!;

  const customerById = new Map<string, { phone?: string; shopName?: string; name?: string }>();
  for (const c of await db.collection("customers").find({}).toArray()) {
    customerById.set(String(c._id), {
      phone: typeof c.phone === "string" ? c.phone.trim() : "",
      shopName: typeof c.shopName === "string" ? c.shopName.trim() : "",
      name: typeof c.name === "string" ? c.name.trim() : "",
    });
  }

  const query: Record<string, unknown> = {};
  if (shopFilter) {
    query.$or = [
      { "customerInfo.shopName": new RegExp(shopFilter, "i") },
      { "customerInfo.name": new RegExp(shopFilter, "i") },
    ];
  }

  const bills = (await db.collection("bills").find(query).toArray()) as BillDoc[];
  let touched = 0;

  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Bills scanned: ${bills.length}`);

  for (const bill of bills) {
    const info = bill.customerInfo;
    if (!info) continue;

    const next = { ...info };
    let changed = false;

    if (typeof next.name === "string" && next.name !== next.name.trim()) {
      next.name = next.name.trim();
      changed = true;
    }
    if (typeof next.shopName === "string" && next.shopName !== next.shopName.trim()) {
      next.shopName = next.shopName.trim();
      changed = true;
    }
    if (typeof next.address === "string" && next.address !== next.address.trim()) {
      next.address = next.address.trim();
      changed = true;
    }
    if (typeof next.gstNumber === "string" && next.gstNumber !== next.gstNumber.trim()) {
      next.gstNumber = next.gstNumber.trim();
      changed = true;
    }

    const rawPhone = toRefString(next.phone);
    const phoneInvalid =
      !rawPhone ||
      rawPhone === "0" ||
      isValidCustomerRef(rawPhone) ||
      !getBillPhone({ phone: rawPhone });

    if (phoneInvalid) {
      const customerId = toRefString(next.customer);
      const linked = isValidCustomerRef(customerId)
        ? customerById.get(customerId)
        : undefined;
      const fixedPhone = linked?.phone && getBillPhone({ phone: linked.phone })
        ? linked.phone.trim()
        : "";

      if (fixedPhone && fixedPhone !== rawPhone) {
        next.phone = fixedPhone;
        changed = true;
      } else if (rawPhone && rawPhone !== fixedPhone) {
        next.phone = fixedPhone;
        changed = true;
      }
    }

    if (!changed) continue;

    touched += 1;
    console.log(
      `${bill.invoiceNumber}: ${JSON.stringify(info)} -> ${JSON.stringify(next)}`
    );

    if (apply) {
      await db.collection("bills").updateOne(
        { _id: bill._id },
        { $set: { customerInfo: next } }
      );
    }
  }

  console.log(`\n${apply ? "Updated" : "Would update"} ${touched} bill(s).`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

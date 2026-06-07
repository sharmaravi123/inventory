/**
 * CLI: renumber all sales bills to INV-{FY}-000001 (Indian FY Apr–Mar) + sync counters.
 *
 * Development (loads .env.local first, then MONGODB_URI):
 *   npm run migrate:invoices
 *
 * Production (set URI in shell; do not commit secrets):
 *   $env:MONGODB_URI="mongodb+srv://..."; npm run migrate:invoices
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal(): void {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
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
    if (key && process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

async function main(): Promise<void> {
  if (!process.env.MONGODB_URI?.trim()) {
    console.error(
      "Missing MONGODB_URI. Add it to .env.local or set it in the shell before running."
    );
    process.exit(1);
  }

  const { runMigrateFyInvoices } = await import("../src/lib/migrateFyInvoices");

  console.log("Starting FY invoice migration…");
  const result = await runMigrateFyInvoices();
  console.log(JSON.stringify(result, null, 2));

  const mongoose = (await import("mongoose")).default;
  await mongoose.disconnect();

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

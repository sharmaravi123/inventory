/**
 * CLI: renumber sales bills — INV-{FY}-000001 (Indian FY Apr–Mar) + sync counters.
 *
 * Default: only bills with financial year >= 2026 (Apr 2026–Mar 2027 onward) → INV-2026-000001…
 *
 *   npm run migrate:invoices          # uses .env.local MONGODB_URI
 *
 * All years:
 *   MIGRATE_MIN_FY=all npm run migrate:invoices
 *
 * Custom FY floor:
 *   MIGRATE_MIN_FY=2025 npm run migrate:invoices
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

  const raw = process.env.MIGRATE_MIN_FY?.trim();
  let opts: { minFinancialYear?: number } = { minFinancialYear: 2026 };
  if (raw === "all" || raw === "0") {
    opts = {};
  } else if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      opts = { minFinancialYear: n };
    }
  }

  console.log(
    "Starting FY invoice migration…",
    opts.minFinancialYear != null
      ? `(only FY >= ${opts.minFinancialYear}; set MIGRATE_MIN_FY=all for every FY)`
      : "(all financial years)"
  );
  const result = await runMigrateFyInvoices(opts);
  console.log(JSON.stringify(result, null, 2));

  const mongoose = (await import("mongoose")).default;
  await mongoose.disconnect();

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

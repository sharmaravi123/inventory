import dbConnect from "./mongodb";
import BillModel from "../models/Bill";
import InvoiceCounterModel from "../models/InvoiceCounter";
import { getIndianFinancialYearStartYear } from "./financialYear";
import { renumberSalesInvoicesForFinancialYear } from "./salesInvoiceNumber";

export type MigrateFyInvoicesOptions = {
  /**
   * If set, only bills whose Indian FY (Apr–Mar) is >= this year are renumbered.
   * Older bills keep their current `invoiceNumber`. Counters are updated only for touched FYs.
   * Omit or use `all` / 0 in CLI for full renumber of every bill.
   */
  minFinancialYear?: number;
};

export type MigrateFyInvoicesResult = {
  ok: true;
  message: string;
  totalBills: number;
  skippedBills: number;
  counts: Record<string, number>;
};

/**
 * Renumbers bills by Indian FY — INV-YYYY-000001 per FY (Apr–Mar),
 * ordered by billDate then createdAt. Syncs per-FY InvoiceCounter for touched FYs.
 */
export async function runMigrateFyInvoices(
  options: MigrateFyInvoicesOptions = {}
): Promise<MigrateFyInvoicesResult> {
  await dbConnect();

  const minFy = options.minFinancialYear;

  const allBills = await BillModel.find({})
    .select("_id billDate createdAt invoiceNumber")
    .lean();

  if (allBills.length === 0) {
    return {
      ok: true,
      message: "No bills to migrate.",
      totalBills: 0,
      skippedBills: 0,
      counts: {},
    };
  }

  const bills =
    typeof minFy === "number" && Number.isFinite(minFy)
      ? allBills.filter(
          (b) =>
            getIndianFinancialYearStartYear(
              new Date(b.billDate || b.createdAt || Date.now())
            ) >= minFy
        )
      : allBills;

  const skippedBills = allBills.length - bills.length;

  if (bills.length === 0) {
    return {
      ok: true,
      message:
        typeof minFy === "number"
          ? `No bills in financial year >= ${minFy}.`
          : "No bills to migrate.",
      totalBills: 0,
      skippedBills,
      counts: {},
    };
  }

  const fySet = new Set<number>();
  for (const b of bills) {
    fySet.add(
      getIndianFinancialYearStartYear(
        new Date(b.billDate || b.createdAt || Date.now())
      )
    );
  }

  const counts: Record<string, number> = {};
  for (const fy of Array.from(fySet).sort((a, b) => a - b)) {
    counts[`INV-${fy}`] = await renumberSalesInvoicesForFinancialYear(fy);
  }

  await InvoiceCounterModel.deleteOne({ name: "default" }).catch(() => {
    /* ignore */
  });

  const scope =
    typeof minFy === "number"
      ? `Financial year >= ${minFy} (Apr ${minFy}–Mar ${minFy + 1} and later FYs).`
      : "All financial years.";

  return {
    ok: true,
    message: `Bills renumbered (${scope}) Skipped ${skippedBills} bill(s) not in scope. Fixed temp/__REN__ numbers.`,
    totalBills: bills.length,
    skippedBills,
    counts,
  };
}

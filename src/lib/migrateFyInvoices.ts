import dbConnect from "./mongodb";
import BillModel from "../models/Bill";
import InvoiceCounterModel from "../models/InvoiceCounter";
import {
  formatSalesInvoiceNumber,
  getIndianFinancialYearStartYear,
} from "./financialYear";

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
    .sort({ billDate: 1, createdAt: 1 })
    .select("_id billDate")
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
            getIndianFinancialYearStartYear(new Date(b.billDate)) >= minFy
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

  for (const b of bills) {
    await BillModel.updateOne(
      { _id: b._id },
      { invoiceNumber: `__MIGR__${String(b._id)}` }
    );
  }

  type LeanBill = (typeof bills)[number];
  const byFy = new Map<number, LeanBill[]>();
  for (const b of bills) {
    const fy = getIndianFinancialYearStartYear(new Date(b.billDate));
    if (!byFy.has(fy)) byFy.set(fy, []);
    byFy.get(fy)!.push(b);
  }

  const fyYears = Array.from(byFy.keys()).sort((a, b) => a - b);
  const counts: Record<string, number> = {};

  for (const fy of fyYears) {
    const list = byFy.get(fy)!;
    let seq = 0;
    for (const b of list) {
      seq += 1;
      const inv = formatSalesInvoiceNumber(fy, seq);
      await BillModel.updateOne({ _id: b._id }, { invoiceNumber: inv });
    }
    counts[`INV-${fy}`] = seq;
    await InvoiceCounterModel.findOneAndUpdate(
      { name: `fy${fy}` },
      { $set: { name: `fy${fy}`, seq } },
      { upsert: true }
    );
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
    message: `Bills renumbered (${scope}) Skipped ${skippedBills} bill(s) not in scope.`,
    totalBills: bills.length,
    skippedBills,
    counts,
  };
}

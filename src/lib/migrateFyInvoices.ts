import dbConnect from "./mongodb";
import BillModel from "../models/Bill";
import InvoiceCounterModel from "../models/InvoiceCounter";
import {
  formatSalesInvoiceNumber,
  getIndianFinancialYearStartYear,
} from "./financialYear";

export type MigrateFyInvoicesResult = {
  ok: true;
  message: string;
  totalBills: number;
  counts: Record<string, number>;
};

/**
 * Renumbers all bills by Indian FY — INV-YYYY-000001 per FY (Apr–Mar),
 * ordered by billDate then createdAt. Syncs per-FY InvoiceCounter seq.
 */
export async function runMigrateFyInvoices(): Promise<MigrateFyInvoicesResult> {
  await dbConnect();

  const bills = await BillModel.find({})
    .sort({ billDate: 1, createdAt: 1 })
    .select("_id billDate")
    .lean();

  if (bills.length === 0) {
    return {
      ok: true,
      message: "No bills to migrate.",
      totalBills: 0,
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

  return {
    ok: true,
    message:
      "All bills renumbered by Indian FY (Apr–Mar). New invoices use the same scheme.",
    totalBills: bills.length,
    counts,
  };
}

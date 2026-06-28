import dbConnect from "@/lib/mongodb";
import {
  formatSalesInvoiceNumber,
  getIndianFinancialYearStartYear,
} from "@/lib/financialYear";
import { parseInvoiceNumber } from "@/lib/invoiceSort";
import BillModel from "@/models/Bill";
import BillReturnModel from "@/models/BillReturn";
import InvoiceCounterModel from "@/models/InvoiceCounter";
import { randomBytes } from "node:crypto";
import { Types } from "mongoose";

/** Unique placeholder while assigning final invoice (never left on saved bills). */
export function makePendingInvoiceNumber(): string {
  return `__PEND__${randomBytes(12).toString("hex")}`;
}

function fyInvoiceRegex(financialYearStart: number): RegExp {
  return new RegExp(`^INV-${financialYearStart}-\\d{6}$`);
}

function tempInvoiceForId(id: unknown): string {
  return `__TMP__${String(id)}`;
}

function sortBillsByDate<
  T extends { billDate?: Date | string | null; createdAt?: Date | string | null }
>(bills: T[]): T[] {
  return [...bills].sort((a, b) => {
    const da = new Date(a.billDate || a.createdAt || 0).getTime();
    const db = new Date(b.billDate || b.createdAt || 0).getTime();
    if (da !== db) return da - db;
    return (
      new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
  });
}

type BillRow = {
  _id: unknown;
  billDate?: Date | string | null;
  createdAt?: Date | string | null;
  invoiceNumber?: string;
};

function getFyDateRange(fy: number): { start: Date; end: Date } {
  return {
    start: new Date(fy, 3, 1, 0, 0, 0, 0),
    end: new Date(fy + 1, 2, 31, 23, 59, 59, 999),
  };
}

function isInFinancialYear(
  bill: BillRow,
  financialYearStart: number
): boolean {
  return (
    getIndianFinancialYearStartYear(
      new Date(bill.billDate || bill.createdAt || Date.now())
    ) === financialYearStart
  );
}

async function syncInvoiceCounter(fy: number, seq: number): Promise<void> {
  await InvoiceCounterModel.findOneAndUpdate(
    { name: `fy${fy}` },
    { $set: { name: `fy${fy}`, seq } },
    { upsert: true }
  );
}

/** Bills in one FY ordered by billDate then createdAt. */
export async function fetchOrderedBillsInFy(
  financialYearStart: number,
  excludeId?: string
): Promise<BillRow[]> {
  await dbConnect();
  const { start, end } = getFyDateRange(financialYearStart);
  const filter: Record<string, unknown> = {
    billDate: { $gte: start, $lte: end },
  };
  if (excludeId) {
    filter._id = { $ne: new Types.ObjectId(excludeId) };
  }

  const rows = (await BillModel.find(filter)
    .select("_id billDate createdAt invoiceNumber")
    .lean()) as BillRow[];

  return sortBillsByDate(
    rows.filter((b) => isInFinancialYear(b, financialYearStart))
  );
}

function findInsertIndex(
  ordered: BillRow[],
  billDate: Date,
  createdAt: Date
): number {
  const bd = billDate.getTime();
  const ca = createdAt.getTime();
  let index = 0;

  for (const bill of ordered) {
    const billTime = new Date(bill.billDate || bill.createdAt || 0).getTime();
    const createdTime = new Date(bill.createdAt || 0).getTime();
    if (billTime < bd) {
      index += 1;
    } else if (billTime === bd && createdTime < ca) {
      index += 1;
    } else {
      break;
    }
  }

  return index;
}

async function bulkSetInvoiceNumbers(
  updates: { id: unknown; invoiceNumber: string }[]
): Promise<void> {
  if (updates.length === 0) return;

  await BillModel.bulkWrite(
    updates.map(({ id, invoiceNumber }) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { invoiceNumber } },
      },
    }))
  );

  await Promise.all(
    updates.map(({ id, invoiceNumber }) =>
      BillReturnModel.updateMany({ bill: id }, { $set: { invoiceNumber } })
    )
  );
}

/**
 * Assign invoice by bill date position — fast append, bulk shift when inserting in middle.
 * Never leaves __TMP__ / __PEND__ on success.
 */
export async function assignInvoiceForNewBill(
  billId: Types.ObjectId | string,
  billDate: Date,
  createdAt: Date = new Date()
): Promise<string> {
  await dbConnect();
  const fy = getIndianFinancialYearStartYear(billDate);
  const existing = await fetchOrderedBillsInFy(fy, String(billId));
  const insertIndex = findInsertIndex(existing, billDate, createdAt);
  const newSeq = insertIndex + 1;
  const newInvoice = formatSalesInvoiceNumber(fy, newSeq);

  if (insertIndex >= existing.length) {
    await BillModel.updateOne({ _id: billId }, { invoiceNumber: newInvoice });
    await syncInvoiceCounter(fy, existing.length + 1);
    return newInvoice;
  }

  const toShift = existing.slice(insertIndex);

  await bulkSetInvoiceNumbers(
    toShift.map((b) => ({ id: b._id, invoiceNumber: tempInvoiceForId(b._id) }))
  );

  await BillModel.updateOne({ _id: billId }, { invoiceNumber: newInvoice });

  await bulkSetInvoiceNumbers(
    toShift.map((b, i) => ({
      id: b._id,
      invoiceNumber: formatSalesInvoiceNumber(fy, newSeq + 1 + i),
    }))
  );

  await syncInvoiceCounter(fy, existing.length + 1);
  return newInvoice;
}

/** Close gap after delete — only shifts bills above the removed serial. */
export async function compactInvoicesAfterDelete(
  financialYearStart: number,
  deletedInvoiceNumber: string
): Promise<void> {
  await dbConnect();
  const deletedSeq = parseInvoiceNumber(String(deletedInvoiceNumber || "")).seq;
  if (!deletedSeq) return;

  const fyRe = fyInvoiceRegex(financialYearStart);
  const bills = await BillModel.find({ invoiceNumber: { $regex: fyRe } })
    .select("_id invoiceNumber")
    .lean();

  const toShift = bills
    .map((b) => ({
      _id: b._id,
      seq: parseInvoiceNumber(String(b.invoiceNumber || "")).seq,
    }))
    .filter((b) => b.seq > deletedSeq)
    .sort((a, b) => b.seq - a.seq);

  if (toShift.length === 0) {
    await syncInvoiceCounter(financialYearStart, deletedSeq - 1);
    return;
  }

  await bulkSetInvoiceNumbers(
    toShift.map((b) => ({ id: b._id, invoiceNumber: tempInvoiceForId(b._id) }))
  );

  await bulkSetInvoiceNumbers(
    toShift.map((b) => ({
      id: b._id,
      invoiceNumber: formatSalesInvoiceNumber(financialYearStart, b.seq - 1),
    }))
  );

  const remaining = await BillModel.countDocuments({
    invoiceNumber: { $regex: fyRe },
  });
  await syncInvoiceCounter(financialYearStart, remaining);
}

/** When bill date changes on edit — reposition without full FY renumber. */
export async function repositionBillInvoice(
  billId: Types.ObjectId | string,
  billDate: Date,
  createdAt: Date,
  previousInvoiceNumber: string
): Promise<string> {
  await BillModel.updateOne(
    { _id: billId },
    { invoiceNumber: tempInvoiceForId(billId) }
  );

  const prevInv = String(previousInvoiceNumber || "");
  if (/^INV-\d{4}-\d{6}$/i.test(prevInv)) {
    const prevFy = parseInvoiceNumber(prevInv).fy;
    if (prevFy) await compactInvoicesAfterDelete(prevFy, prevInv);
  }

  return assignInvoiceForNewBill(billId, billDate, createdAt);
}

/** Highest numeric suffix among bills INV-{fy}-NNNNNN. */
async function getMaxInvoiceSeqFromBills(fy: number): Promise<number> {
  const bills = await BillModel.find({
    invoiceNumber: { $regex: fyInvoiceRegex(fy) },
  })
    .select("invoiceNumber")
    .lean();

  let max = 0;
  for (const b of bills) {
    const inv = String(b.invoiceNumber || "");
    const m = inv.match(/-(\d{6})$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

export async function getNextInvoiceNumber(
  billDate: Date = new Date()
): Promise<string> {
  await dbConnect();

  const fy = getIndianFinancialYearStartYear(billDate);
  const name = `fy${fy}`;
  const billMax = await getMaxInvoiceSeqFromBills(fy);

  const counter = await InvoiceCounterModel.findOneAndUpdate(
    { name },
    [
      {
        $set: {
          name,
          seq: {
            $add: [
              {
                $max: [{ $ifNull: ["$seq", 0] }, billMax],
              },
              1,
            ],
          },
        },
      },
    ],
    { new: true, upsert: true }
  ).exec();

  if (!counter) {
    throw new Error("Failed to generate invoice number");
  }

  return formatSalesInvoiceNumber(fy, counter.seq);
}

/** Full FY repair (migration / recovery only) — uses bulkWrite. */
export async function renumberSalesInvoicesForFinancialYear(
  financialYearStart: number
): Promise<number> {
  await dbConnect();

  const ordered = await fetchOrderedBillsInFy(financialYearStart);

  if (ordered.length === 0) {
    await syncInvoiceCounter(financialYearStart, 0);
    return 0;
  }

  await bulkSetInvoiceNumbers(
    ordered.map((b) => ({ id: b._id, invoiceNumber: tempInvoiceForId(b._id) }))
  );

  await bulkSetInvoiceNumbers(
    ordered.map((b, i) => ({
      id: b._id,
      invoiceNumber: formatSalesInvoiceNumber(financialYearStart, i + 1),
    }))
  );

  await syncInvoiceCounter(financialYearStart, ordered.length);
  return ordered.length;
}

export async function repairAllSalesInvoiceNumbers(): Promise<
  Record<string, number>
> {
  await dbConnect();

  const allBills = (await BillModel.find({})
    .select("_id billDate createdAt invoiceNumber")
    .lean()) as BillRow[];

  const fySet = new Set<number>();
  for (const bill of allBills) {
    fySet.add(
      getIndianFinancialYearStartYear(
        new Date(bill.billDate || bill.createdAt || Date.now())
      )
    );
  }

  const counts: Record<string, number> = {};
  for (const fy of Array.from(fySet).sort((a, b) => a - b)) {
    const count = await renumberSalesInvoicesForFinancialYear(fy);
    if (count > 0) counts[`INV-${fy}`] = count;
  }

  return counts;
}

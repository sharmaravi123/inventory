import dbConnect from "@/lib/mongodb";
import {
  formatSalesInvoiceNumber,
  getIndianFinancialYearStartYear,
} from "@/lib/financialYear";
import BillModel from "@/models/Bill";
import InvoiceCounterModel from "@/models/InvoiceCounter";

/** Highest numeric suffix among bills INV-{fy}-NNNNNN. */
async function getMaxInvoiceSeqFromBills(fy: number): Promise<number> {
  const re = new RegExp(`^INV-${fy}-[0-9]{6}$`);
  const bills = await BillModel.find({ invoiceNumber: { $regex: re } })
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

/**
 * Next sales invoice: INV-{FY}-000001 using Indian FY (Apr–Mar).
 * Sequence stays above max existing INV-{FY}-###### so upgrades work without migration.
 */
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

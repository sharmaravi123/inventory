import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import BillModel from "@/models/Bill";
import CustomerModel from "@/models/Customer";
import {
  buildExpandedLedgerBillQuery,
  buildLedgerBillQuery,
  decodeCustomerKey,
  filterLedgerBillsWithAliases,
  resolveLedgerCustomerDocLookup,
  resolveLedgerCustomerKey,
} from "@/lib/customerLedgerMatch";
import { getBillPhone } from "@/lib/customerIdentity";

type PeriodType = "all" | "thisMonth" | "lastMonth" | "custom";

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const endOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

function pickMostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  let best = "";
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

type BillWithCustomerInfo = {
  customerInfo?: {
    name?: string;
    shopName?: string;
    phone?: string;
    address?: string;
    gstNumber?: string;
    customer?: unknown;
  };
};

function pickCustomerFieldsFromBills(bills: BillWithCustomerInfo[]) {
  const shops: string[] = [];
  const names: string[] = [];
  const phones: string[] = [];
  const addresses: string[] = [];
  const gstNumbers: string[] = [];

  for (const bill of bills) {
    const info = bill.customerInfo;
    if (!info) continue;

    const shop = normalizeText(info.shopName);
    const name = normalizeText(info.name);
    const phone = getBillPhone(info);
    const address = normalizeText(info.address);
    const gstNumber = normalizeText(info.gstNumber);

    if (shop) shops.push(shop);
    if (name) names.push(name);
    if (phone) phones.push(phone);
    if (address) addresses.push(address);
    if (gstNumber) gstNumbers.push(gstNumber);
  }

  return {
    shopName: pickMostCommon(shops),
    contactName: pickMostCommon(names),
    phone: pickMostCommon(phones),
    address: pickMostCommon(addresses),
    gstNumber: pickMostCommon(gstNumbers),
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ customerKey: string }> }
) {
  try {
    await dbConnect();

    const { customerKey } = await context.params;
    let decodedKey = decodeCustomerKey(customerKey);
    if (!decodedKey) {
      return NextResponse.json({ error: "customerKey is required" }, { status: 400 });
    }

    const periodParam = (req.nextUrl.searchParams.get("period") || "thisMonth").trim();
    const period: PeriodType =
      periodParam === "all" || periodParam === "thisMonth" || periodParam === "lastMonth" || periodParam === "custom"
        ? periodParam
        : "thisMonth";
    const fromParam = req.nextUrl.searchParams.get("from") || "";
    const toParam = req.nextUrl.searchParams.get("to") || "";

    const billSelect =
      "_id invoiceNumber billDate customerInfo grandTotal amountCollected balanceAmount status createdAt";

    const savedCustomers = await CustomerModel.find()
      .select("_id name shopName phone address gstNumber")
      .lean();

    const customerRows = savedCustomers.map((customer) => ({
      _id: String(customer._id),
      name: customer.name,
      shopName: customer.shopName,
      phone: customer.phone,
    }));

    let billQuery = buildLedgerBillQuery(decodedKey);
    let rawBills = await BillModel.find(billQuery)
      .select(billSelect)
      .sort({ billDate: -1, createdAt: -1 })
      .lean();

    const resolvedKey = resolveLedgerCustomerKey(
      decodedKey,
      customerRows,
      rawBills
    );
    if (resolvedKey !== decodedKey) {
      decodedKey = resolvedKey;
      billQuery = buildLedgerBillQuery(decodedKey);
      rawBills = await BillModel.find(billQuery)
        .select(billSelect)
        .sort({ billDate: -1, createdAt: -1 })
        .lean();
    }

    const lookup = resolveLedgerCustomerDocLookup(decodedKey);
    let customerDoc: {
      _id: unknown;
      name?: string;
      shopName?: string;
      phone?: string;
      address?: string;
      gstNumber?: string;
    } | null = null;

    if (lookup.byId) {
      customerDoc = await CustomerModel.findById(lookup.byId)
        .select("_id name shopName phone address gstNumber")
        .lean();
    } else if (lookup.byPhone) {
      customerDoc = await CustomerModel.findOne({ phone: lookup.byPhone })
        .select("_id name shopName phone address gstNumber")
        .lean();
    } else if (lookup.byShop) {
      const shopRegex = new RegExp(
        `^\\s*${lookup.byShop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
        "i"
      );
      customerDoc = await CustomerModel.findOne({
        $or: [{ shopName: shopRegex }, { name: shopRegex }],
      })
        .select("_id name shopName phone address gstNumber")
        .lean();
    }

    if (
      decodedKey.startsWith("shop:") ||
      decodedKey.startsWith("phone:")
    ) {
      const expandedQuery = buildExpandedLedgerBillQuery(decodedKey, rawBills);
      const expandedBills = await BillModel.find(expandedQuery)
        .select(billSelect)
        .sort({ billDate: -1, createdAt: -1 })
        .lean();

      const byId = new Map<string, (typeof rawBills)[number]>();
      for (const bill of [...rawBills, ...expandedBills]) {
        byId.set(String(bill._id), bill);
      }
      rawBills = Array.from(byId.values()).sort((a, b) => {
        const aTime = new Date(a.billDate || a.createdAt || 0).getTime();
        const bTime = new Date(b.billDate || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
    }

    const bills = filterLedgerBillsWithAliases(
      decodedKey,
      rawBills,
      customerRows
    );

    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const previousMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const previousMonthEnd = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    const parsedFrom = fromParam ? new Date(`${fromParam}T00:00:00`) : null;
    const parsedTo = toParam ? new Date(`${toParam}T00:00:00`) : null;
    const customFrom = parsedFrom && !Number.isNaN(parsedFrom.getTime()) ? startOfDay(parsedFrom) : null;
    const customTo = parsedTo && !Number.isNaN(parsedTo.getTime()) ? endOfDay(parsedTo) : null;

    const inRange = (date: Date, from: Date, to: Date) => date >= from && date <= to;

    const getBillDate = (bill: { billDate?: Date; createdAt?: Date }) => {
      if (bill.billDate) return startOfDay(new Date(bill.billDate));
      if (bill.createdAt) return startOfDay(new Date(bill.createdAt));
      return null;
    };

    const toTotals = (rows: typeof bills) =>
      rows.reduce(
        (acc, row) => {
          acc.totalBilled += toNumber(row.grandTotal);
          acc.totalPaid += toNumber(row.amountCollected);
          acc.totalRemaining += toNumber(row.balanceAmount);
          return acc;
        },
        { totalBilled: 0, totalPaid: 0, totalRemaining: 0 }
      );

    const thisMonthBills = bills.filter((bill) => {
      const date = getBillDate(bill);
      return date ? inRange(date, thisMonthStart, thisMonthEnd) : false;
    });
    const lastMonthBills = bills.filter((bill) => {
      const date = getBillDate(bill);
      return date ? inRange(date, previousMonthStart, previousMonthEnd) : false;
    });

    let selectedBills = bills;
    if (period === "thisMonth") {
      selectedBills = thisMonthBills;
    } else if (period === "lastMonth") {
      selectedBills = lastMonthBills;
    } else if (period === "custom" && customFrom && customTo) {
      selectedBills = bills.filter((bill) => {
        const date = getBillDate(bill);
        return date ? inRange(date, customFrom, customTo) : false;
      });
    }

    const latestInfo = bills[0]?.customerInfo;
    const fromBills = pickCustomerFieldsFromBills(bills);

    const shopName =
      fromBills.shopName || normalizeText(customerDoc?.shopName) || "";
    const contactName =
      fromBills.contactName ||
      normalizeText(customerDoc?.name) ||
      normalizeText(latestInfo?.name) ||
      "Unknown";

    const customer = {
      id:
        typeof customerDoc?._id !== "undefined"
          ? String(customerDoc._id)
          : normalizeText(latestInfo?.customer) || decodedKey,
      name: contactName,
      shopName,
      displayName: shopName || contactName,
      phone:
        fromBills.phone ||
        getBillPhone({ phone: customerDoc?.phone }) ||
        getBillPhone({ phone: latestInfo?.phone }) ||
        "",
      address:
        fromBills.address ||
        normalizeText(customerDoc?.address) ||
        normalizeText(latestInfo?.address),
      gstNumber:
        fromBills.gstNumber ||
        normalizeText(customerDoc?.gstNumber) ||
        normalizeText(latestInfo?.gstNumber),
    };

    return NextResponse.json({
      customer,
      period,
      range: {
        from: customFrom ? customFrom.toISOString() : null,
        to: customTo ? customTo.toISOString() : null,
      },
      totals: {
        allTime: toTotals(bills),
        thisMonth: toTotals(thisMonthBills),
        lastMonth: toTotals(lastMonthBills),
        selected: toTotals(selectedBills),
      },
      billCount: {
        allTime: bills.length,
        selected: selectedBills.length,
      },
      bills: selectedBills.map((bill) => ({
        id: String(bill._id),
        invoiceNumber: bill.invoiceNumber || "-",
        billDate: bill.billDate || bill.createdAt || null,
        grandTotal: toNumber(bill.grandTotal),
        amountCollected: toNumber(bill.amountCollected),
        balanceAmount: toNumber(bill.balanceAmount),
        status: bill.status || "PENDING",
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load customer ledger";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

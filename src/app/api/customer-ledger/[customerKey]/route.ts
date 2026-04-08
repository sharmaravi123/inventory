import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import BillModel from "@/models/Bill";
import CustomerModel from "@/models/Customer";

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

const decodeParam = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ customerKey: string }> }
) {
  try {
    await dbConnect();

    const { customerKey } = await context.params;
    const decodedKey = decodeParam(customerKey).trim();
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

    const keyValues = new Set<string>();
    keyValues.add(decodedKey);

    let customerDoc: {
      _id: unknown;
      name?: string;
      shopName?: string;
      phone?: string;
      address?: string;
      gstNumber?: string;
    } | null = null;

    if (mongoose.Types.ObjectId.isValid(decodedKey)) {
      customerDoc = await CustomerModel.findById(decodedKey)
        .select("_id name shopName phone address gstNumber")
        .lean();
      if (customerDoc) {
        [customerDoc.phone, customerDoc.name, customerDoc.shopName]
          .map((value) => normalizeText(value))
          .filter(Boolean)
          .forEach((value) => keyValues.add(value));
      }
    }

    const conditions: Record<string, unknown>[] = [];
    if (mongoose.Types.ObjectId.isValid(decodedKey)) {
      conditions.push({
        "customerInfo.customer": new mongoose.Types.ObjectId(decodedKey),
      });
    }
    for (const key of keyValues) {
      conditions.push({ "customerInfo.phone": key });
      conditions.push({ "customerInfo.name": key });
      conditions.push({ "customerInfo.shopName": key });
    }

    const bills = await BillModel.find({ $or: conditions })
      .select(
        "_id invoiceNumber billDate customerInfo grandTotal amountCollected balanceAmount status createdAt"
      )
      .sort({ billDate: -1, createdAt: -1 })
      .lean();

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
    const customer = {
      id:
        typeof customerDoc?._id !== "undefined"
          ? String(customerDoc._id)
          : normalizeText(latestInfo?.customer) || decodedKey,
      name: normalizeText(customerDoc?.name) || normalizeText(latestInfo?.name) || "Unknown",
      shopName: normalizeText(customerDoc?.shopName) || normalizeText(latestInfo?.shopName),
      phone: normalizeText(customerDoc?.phone) || normalizeText(latestInfo?.phone),
      address: normalizeText(customerDoc?.address) || normalizeText(latestInfo?.address),
      gstNumber: normalizeText(customerDoc?.gstNumber) || normalizeText(latestInfo?.gstNumber),
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

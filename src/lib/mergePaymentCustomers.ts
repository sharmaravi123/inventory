import type { Bill } from "@/store/billingApi";
import {
  extractPhoneFromCanonical,
  findDbCustomerIdForCanonical,
  getBillPhone,
  getPaymentMergeKey,
  isValidPhone,
  normalizeCustomerText,
  phoneCanonicalKey,
  shopCanonicalKey,
} from "@/lib/customerIdentity";

export type PaymentCustomerAgg = {
  customerId: string;
  dbId?: string;
  name: string;
  shopName?: string;
  phone: string;
  address?: string;
  gstNumber?: string;
  bills: Bill[];
  totalOrders: number;
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
  periodOrders: number;
  periodBilled: number;
  periodPaid: number;
  periodDue: number;
  lastBillDate: string | null;
};

type BillMetricsInput = {
  getBillDue: (bill: Bill) => number;
  getBillPaid: (bill: Bill) => number;
  isWithinRange: (bill: Bill) => boolean;
};

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

function recalculateEntryMetrics(
  entry: PaymentCustomerAgg,
  metrics: BillMetricsInput
): PaymentCustomerAgg {
  const { getBillDue, getBillPaid, isWithinRange } = metrics;

  const next: PaymentCustomerAgg = {
    ...entry,
    bills: [...entry.bills],
    totalOrders: 0,
    totalBilled: 0,
    totalPaid: 0,
    totalDue: 0,
    periodOrders: 0,
    periodBilled: 0,
    periodPaid: 0,
    periodDue: 0,
    lastBillDate: null,
  };

  const shops: string[] = [];
  const names: string[] = [];
  const phones: string[] = [];

  for (const bill of next.bills) {
    const info = bill.customerInfo || {};
    if (info.shopName) shops.push(normalizeCustomerText(info.shopName));
    if (info.name) names.push(normalizeCustomerText(info.name));
    const billPhone = getBillPhone(info);
    if (billPhone) phones.push(billPhone);

    const billDateRaw = bill.billDate;
    if (billDateRaw) {
      const prev = next.lastBillDate
        ? new Date(next.lastBillDate).getTime()
        : 0;
      const nextTime = new Date(billDateRaw).getTime();
      if (!Number.isNaN(nextTime) && nextTime >= prev) {
        next.lastBillDate = billDateRaw;
      }
    }

    const due = getBillDue(bill);
    const paid = getBillPaid(bill);
    const billed = due + paid;

    next.totalOrders += 1;
    next.totalBilled += billed;
    next.totalPaid += paid;
    next.totalDue += due;

    if (isWithinRange(bill)) {
      next.periodOrders += 1;
      next.periodBilled += billed;
      next.periodPaid += paid;
      next.periodDue += due;
    }
  }

  const bestShop = pickMostCommon(shops);
  const bestName = pickMostCommon(names);
  const bestPhone = pickMostCommon(phones);

  if (bestShop) next.shopName = bestShop;
  if (bestName) next.name = bestName;
  if (bestPhone) next.phone = bestPhone;
  else if (!isValidPhone(next.phone)) next.phone = "-";

  return next;
}

/** Collapse duplicate rows (phone + mongo id + snap) into one customer. */
export function mergePaymentCustomerEntries(
  entries: PaymentCustomerAgg[],
  allCustomers: { _id?: string; phone?: string }[],
  metrics: BillMetricsInput
): PaymentCustomerAgg[] {
  const merged = new Map<string, PaymentCustomerAgg>();

  for (const entry of entries) {
    const mergeKey = getPaymentMergeKey(entry);

    if (!merged.has(mergeKey)) {
      merged.set(mergeKey, {
        ...entry,
        customerId: mergeKey.startsWith("phone:")
          ? mergeKey
          : entry.customerId,
        bills: [...entry.bills],
      });
      continue;
    }

    const existing = merged.get(mergeKey)!;
    const seenBillIds = new Set(existing.bills.map((b) => b._id));

    for (const bill of entry.bills) {
      if (!seenBillIds.has(bill._id)) {
        existing.bills.push(bill);
        seenBillIds.add(bill._id);
      }
    }

    if (!existing.dbId && entry.dbId) existing.dbId = entry.dbId;
    if (!existing.shopName && entry.shopName) existing.shopName = entry.shopName;
    if (!existing.address && entry.address) existing.address = entry.address;
    if (!existing.gstNumber && entry.gstNumber) {
      existing.gstNumber = entry.gstNumber;
    }
    if (existing.phone === "-" && entry.phone !== "-") {
      existing.phone = entry.phone;
    }
  }

  const phoneToDbId = new Map<string, string>();
  for (const cust of allCustomers) {
    const phone = getBillPhone({ phone: cust.phone });
    const id = normalizeCustomerText(cust._id);
    if (phone && id) phoneToDbId.set(phone, id);
  }

  return Array.from(merged.values()).map((entry) => {
    const phone = extractPhoneFromCanonical(entry.customerId);
    if (phone && isValidPhone(phone) && !entry.dbId) {
      entry.dbId = phoneToDbId.get(phone);
    }
    if (!entry.dbId) {
      entry.dbId = findDbCustomerIdForCanonical(entry.customerId, allCustomers);
    }

    const shop = shopCanonicalKey(entry.shopName || "");
    const rawPhone =
      entry.phone && entry.phone !== "-" && isValidPhone(entry.phone)
        ? normalizeCustomerText(entry.phone)
        : extractPhoneFromCanonical(entry.customerId);
    const phoneKey =
      rawPhone && isValidPhone(rawPhone) ? phoneCanonicalKey(rawPhone) : "";

    if (phoneKey) {
      entry.customerId = phoneKey;
    } else if (shop) {
      entry.customerId = shop;
    }

    return recalculateEntryMetrics(entry, metrics);
  });
}

/** Drop empty rows when another row has the same phone/dbId with bills. */
export function dropEmptyDuplicatePaymentRows(
  entries: PaymentCustomerAgg[]
): PaymentCustomerAgg[] {
  return entries.filter((entry) => {
    if (entry.bills.length > 0) return true;

    const entryShop = shopCanonicalKey(entry.shopName || "");
    const entryPhone =
      entry.phone !== "-" && isValidPhone(entry.phone)
        ? normalizeCustomerText(entry.phone)
        : extractPhoneFromCanonical(entry.customerId);

    return !entries.some((other) => {
      if (other === entry || other.bills.length === 0) return false;

      const otherShop = shopCanonicalKey(other.shopName || "");
      if (entryShop && otherShop && entryShop === otherShop) return true;

      const otherPhone =
        other.phone !== "-" && isValidPhone(other.phone)
          ? normalizeCustomerText(other.phone)
          : extractPhoneFromCanonical(other.customerId);

      if (
        entryPhone &&
        otherPhone &&
        isValidPhone(entryPhone) &&
        entryPhone === otherPhone
      ) {
        return true;
      }
      if (entry.dbId && other.dbId && entry.dbId === other.dbId) return true;

      return false;
    });
  });
}

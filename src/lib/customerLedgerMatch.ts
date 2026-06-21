import mongoose from "mongoose";
import {
  billMatchesSnapshotKey,
  buildBillAwareAliasMap,
  getBillPhone,
  isValidCustomerRef,
  isValidPhone,
  normalizeCustomerText,
  parseSnapshotKey,
  phoneCanonicalKey,
  resolveCustomerCanonicalKey,
  shopCanonicalKey,
  toRefString,
  type CustomerLike,
} from "@/lib/customerIdentity";

export type CustomerDocLike = {
  _id: unknown;
  name?: string;
  shopName?: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
} | null;

export type BillCustomerRow = {
  customerInfo?: {
    customer?: unknown;
    name?: string;
    shopName?: string;
    phone?: string;
    address?: string;
    gstNumber?: string;
  };
};

export function decodeCustomerKey(value: string): string {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

export function buildLedgerBillQuery(decodedKey: string): Record<string, unknown> {
  if (decodedKey.startsWith("phone:")) {
    const phone = decodedKey.slice(6);
    return { "customerInfo.phone": phone };
  }

  if (decodedKey.startsWith("shop:")) {
    const shopNorm = decodedKey.slice(5);
    const shopRegex = new RegExp(`^\\s*${escapeRegex(shopNorm)}\\s*$`, "i");
    return {
      $or: [
        { "customerInfo.shopName": shopRegex },
        { "customerInfo.name": shopRegex },
      ],
    };
  }

  if (decodedKey.startsWith("snap:")) {
    const parsed = parseSnapshotKey(decodedKey);
    if (!parsed) return { _id: null };

    const shopRegex = new RegExp(`^${escapeRegex(parsed.shopNorm)}$`, "i");
    const nameRegex = new RegExp(`^${escapeRegex(parsed.nameNorm)}$`, "i");

    if (parsed.shopNorm && parsed.nameNorm) {
      return {
        $and: [
          {
            $or: [
              { "customerInfo.shopName": shopRegex },
              {
                $and: [
                  { "customerInfo.shopName": { $in: ["", null] } },
                  { "customerInfo.name": shopRegex },
                ],
              },
            ],
          },
          { "customerInfo.name": nameRegex },
        ],
      };
    }

    return {
      $or: [
        { "customerInfo.shopName": shopRegex },
        { "customerInfo.name": nameRegex },
      ],
    };
  }

  if (mongoose.Types.ObjectId.isValid(decodedKey)) {
    const or: Record<string, unknown>[] = [
      { "customerInfo.customer": new mongoose.Types.ObjectId(decodedKey) },
      { "customerInfo.customer": decodedKey },
    ];
    return { $or: or };
  }

  if (/^\d{6,15}$/.test(decodedKey)) {
    return { "customerInfo.phone": decodedKey };
  }

  return {
    $or: [
      { "customerInfo.phone": decodedKey },
      { "customerInfo.name": decodedKey },
      { "customerInfo.shopName": decodedKey },
    ],
  };
}

/** Widen lookup for shop or broken phone keys (0, mongo id in phone field). */
export function buildExpandedLedgerBillQuery(
  decodedKey: string,
  seedBills: BillCustomerRow[]
): Record<string, unknown> {
  const or: Record<string, unknown>[] = [];
  const customerIds = new Set<string>();
  const phones = new Set<string>();
  const shopNorms = new Set<string>();

  if (decodedKey.startsWith("shop:")) {
    const shopNorm = decodedKey.slice(5);
    shopNorms.add(shopNorm);
    const shopRegex = new RegExp(`^\\s*${escapeRegex(shopNorm)}\\s*$`, "i");
    or.push(
      { "customerInfo.shopName": shopRegex },
      { "customerInfo.name": shopRegex }
    );
  } else if (decodedKey.startsWith("phone:")) {
    const phone = decodedKey.slice(6);
    or.push({ "customerInfo.phone": phone });
    phones.add(phone);
  } else {
    return buildLedgerBillQuery(decodedKey);
  }

  for (const bill of seedBills) {
    const info = bill.customerInfo;
    if (!info) continue;

    const customerId = toRefString(info.customer);
    if (isValidCustomerRef(customerId)) customerIds.add(customerId);

    const rawPhone = toRefString(info.phone);
    if (rawPhone) phones.add(rawPhone);

    const shop = normalizeCustomerText(info.shopName).toLowerCase();
    if (shop) shopNorms.add(shop);
    const name = normalizeCustomerText(info.name).toLowerCase();
    if (name && !shop) shopNorms.add(name);
  }

  for (const shopNorm of shopNorms) {
    const shopRegex = new RegExp(`^\\s*${escapeRegex(shopNorm)}\\s*$`, "i");
    or.push(
      { "customerInfo.shopName": shopRegex },
      { "customerInfo.name": shopRegex }
    );
  }

  for (const customerId of customerIds) {
    or.push({ "customerInfo.customer": customerId });
    if (mongoose.Types.ObjectId.isValid(customerId)) {
      or.push({
        "customerInfo.customer": new mongoose.Types.ObjectId(customerId),
      });
    }
  }

  for (const phone of phones) {
    or.push({ "customerInfo.phone": phone });
  }

  return { $or: or };
}

/** Map broken keys (phone:0, phone:mongoId) to shop:/phone: canonical. */
export function resolveLedgerCustomerKey(
  decodedKey: string,
  customers: CustomerLike[],
  seedBills: BillCustomerRow[]
): string {
  if (decodedKey.startsWith("shop:") || decodedKey.startsWith("snap:")) {
    return decodedKey;
  }

  if (decodedKey.startsWith("phone:")) {
    const phone = decodedKey.slice(6);
    if (isValidPhone(phone)) return decodedKey;
  }

  const aliases = buildBillAwareAliasMap(customers, seedBills);

  if (decodedKey.startsWith("phone:")) {
    const phone = decodedKey.slice(6);
    for (const bill of seedBills) {
      if (toRefString(bill.customerInfo?.phone) !== phone) continue;
      const info = bill.customerInfo;
      if (!info) continue;

      const canonical = resolveCustomerCanonicalKey(info, aliases);
      if (canonical !== "unknown" && !canonical.startsWith("phone:")) {
        return canonical;
      }

      const shop = shopCanonicalKey(info.shopName || info.name || "");
      if (shop) return shop;
    }
  }

  if (mongoose.Types.ObjectId.isValid(decodedKey)) {
    return decodedKey;
  }

  return decodedKey;
}

/** Same grouping rules as the payment dashboard list. */
export function filterLedgerBillsWithAliases(
  decodedKey: string,
  bills: BillCustomerRow[],
  customers: CustomerLike[],
  idAliases: Record<string, string> = {}
): BillCustomerRow[] {
  const aliases = buildBillAwareAliasMap(customers, bills, idAliases);
  const targetKey = aliases.get(decodedKey) || decodedKey;

  return bills.filter((bill) => {
    const info = bill.customerInfo;
    if (!info) return false;

    const billKey = resolveCustomerCanonicalKey(info, aliases);
    if (billKey === decodedKey || billKey === targetKey) return true;

    const billTarget = aliases.get(billKey) || billKey;
    return billTarget === targetKey;
  });
}

export function filterLedgerBillsForCustomerKey(
  decodedKey: string,
  customerDoc: CustomerDocLike,
  bills: BillCustomerRow[]
): BillCustomerRow[] {
  const docPhone = normalizeCustomerText(customerDoc?.phone);
  const docId =
    customerDoc?._id !== undefined && customerDoc?._id !== null
      ? String(customerDoc._id)
      : "";

  if (decodedKey.startsWith("phone:")) {
    const phone = decodedKey.slice(6);
    return bills.filter(
      (bill) => normalizeCustomerText(bill.customerInfo?.phone) === phone
    );
  }

  if (decodedKey.startsWith("shop:")) {
    const shopNorm = decodedKey.slice(5);
    return bills.filter((bill) => {
      const info = bill.customerInfo;
      if (!info) return false;
      const shop = normalizeCustomerText(info.shopName).toLowerCase();
      const name = normalizeCustomerText(info.name).toLowerCase();
      if (shop === shopNorm || name === shopNorm) return true;

      const customerId = normalizeCustomerText(info.customer);
      if (!customerId) return false;

      return bills.some((other) => {
        const otherInfo = other.customerInfo;
        if (!otherInfo) return false;
        const otherShop = normalizeCustomerText(otherInfo.shopName).toLowerCase();
        const otherName = normalizeCustomerText(otherInfo.name).toLowerCase();
        const sameShop =
          otherShop === shopNorm ||
          otherName === shopNorm ||
          shop === shopNorm ||
          name === shopNorm;
        if (!sameShop) return false;
        const otherCustomerId = normalizeCustomerText(otherInfo.customer);
        return (
          otherCustomerId === customerId ||
          normalizeCustomerText(otherInfo.phone) ===
            normalizeCustomerText(info.phone)
        );
      });
    });
  }

  if (decodedKey.startsWith("snap:")) {
    return bills.filter((bill) => {
      const info = bill.customerInfo;
      if (!info) return false;
      if (billMatchesSnapshotKey(info, decodedKey)) return true;
      return false;
    });
  }

  if (mongoose.Types.ObjectId.isValid(decodedKey) && customerDoc) {
    return bills.filter((bill) => {
      const info = bill.customerInfo;
      if (!info) return false;

      const billPhone = normalizeCustomerText(info.phone);
      const billCustomerId = normalizeCustomerText(info.customer);

      if (docPhone) {
        if (billPhone && billPhone !== docPhone) return false;
        if (billPhone === docPhone) return true;
      }

      if (
        billCustomerId &&
        isValidCustomerRef(billCustomerId) &&
        billCustomerId === docId
      ) {
        if (docPhone && billPhone && billPhone !== docPhone) return false;
        return true;
      }

      return false;
    });
  }

  if (/^\d{6,15}$/.test(decodedKey)) {
    return bills.filter(
      (bill) => normalizeCustomerText(bill.customerInfo?.phone) === decodedKey
    );
  }

  return bills;
}

export function resolveLedgerCustomerDocLookup(
  decodedKey: string
): { byId: string | null; byPhone: string | null; byShop: string | null } {
  if (decodedKey.startsWith("phone:")) {
    const phone = decodedKey.slice(6);
    return {
      byId: null,
      byPhone: isValidPhone(phone) ? phone : null,
      byShop: null,
    };
  }

  if (decodedKey.startsWith("shop:")) {
    return { byId: null, byPhone: null, byShop: decodedKey.slice(5) };
  }

  if (mongoose.Types.ObjectId.isValid(decodedKey)) {
    return { byId: decodedKey, byPhone: null, byShop: null };
  }

  if (isValidPhone(decodedKey)) {
    return { byId: null, byPhone: decodedKey, byShop: null };
  }

  return { byId: null, byPhone: null, byShop: null };
}

export function canonicalKeyFromCustomerDoc(
  doc: NonNullable<CustomerDocLike>
): string {
  const phone = normalizeCustomerText(doc.phone);
  if (phone) return phoneCanonicalKey(phone);
  return String(doc._id);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

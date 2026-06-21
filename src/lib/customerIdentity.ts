export type CustomerLike = {
  _id?: string;
  name?: string;
  shopName?: string;
  phone?: string;
};

export type BillCustomerLike = {
  customer?: string;
  name?: string;
  shopName?: string;
  phone?: string;
};

export const normalizeCustomerText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/** Mongo ObjectId, string id, or number → trimmed string. */
export function toRefString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && "toString" in value) {
    return String(value).trim();
  }
  return "";
}

/** Invalid or placeholder customer refs on old bills. */
export function isValidCustomerRef(value: unknown): boolean {
  const id = toRefString(value);
  if (!id || id === "0") return false;
  return /^[a-f0-9]{24}$/i.test(id);
}

/** Real phone only — rejects "0", mongo ids stored in phone field, etc. */
export function isValidPhone(value: unknown): boolean {
  const phone = normalizeCustomerText(value);
  if (!phone || phone === "0") return false;
  if (/^[a-f0-9]{24}$/i.test(phone)) return false;
  return /^\d{6,15}$/.test(phone);
}

export function getBillPhone(info: BillCustomerLike): string {
  return isValidPhone(info.phone) ? normalizeCustomerText(info.phone) : "";
}

export function phoneCanonicalKey(phone: string): string {
  return `phone:${normalizeCustomerText(phone)}`;
}

export function shopCanonicalKey(shopName: string): string {
  const shop = normalizeCustomerText(shopName).toLowerCase();
  if (!shop) return "";
  return `shop:${shop}`;
}

export function extractPhoneFromCanonical(canonical: string): string {
  if (canonical.startsWith("phone:")) return canonical.slice(6);
  return "";
}

export function makeCustomerSnapshotKey(
  nameOrInfo: { name?: string; shopName?: string } | string,
  shopName?: string
): string {
  const name =
    typeof nameOrInfo === "string"
      ? nameOrInfo
      : normalizeCustomerText(nameOrInfo.name);
  const shop =
    typeof nameOrInfo === "string"
      ? normalizeCustomerText(shopName)
      : normalizeCustomerText(nameOrInfo.shopName);
  const shopNorm = shop.toLowerCase();
  const nameNorm = name.toLowerCase();
  return `snap:${shopNorm || nameNorm}:${nameNorm}`;
}

export function parseSnapshotKey(key: string): {
  shopNorm: string;
  nameNorm: string;
} | null {
  if (!key.startsWith("snap:")) return null;
  const rest = key.slice(5);
  const colonIdx = rest.indexOf(":");
  if (colonIdx === -1) return null;
  return {
    shopNorm: rest.slice(0, colonIdx),
    nameNorm: rest.slice(colonIdx + 1),
  };
}

export function billMatchesSnapshotKey(
  info: BillCustomerLike,
  snapKey: string
): boolean {
  const parsed = parseSnapshotKey(snapKey);
  if (!parsed) return false;

  const shop = normalizeCustomerText(info.shopName).toLowerCase();
  const name = normalizeCustomerText(info.name).toLowerCase();
  const shopNorm = shop || name;

  return shopNorm === parsed.shopNorm && name === parsed.nameNorm;
}

/** Canonical key for a saved customer: valid phone, else shop, else Mongo id. */
export function getCustomerCanonicalKey(cust: CustomerLike): string {
  const id = normalizeCustomerText(cust._id);
  const phone = getBillPhone({ phone: cust.phone });
  if (phone) return phoneCanonicalKey(phone);

  const shop = shopCanonicalKey(cust.shopName || cust.name || "");
  if (shop) return shop;

  return id;
}

/** Maps duplicate Mongo ids to canonical keys. */
export function buildCustomerAliasMap(
  customers: CustomerLike[],
  idAliases: Record<string, string> = {}
): Map<string, string> {
  const aliases = new Map<string, string>();

  for (const cust of customers) {
    const id = normalizeCustomerText(cust._id);
    if (!id) continue;

    const canonical = getCustomerCanonicalKey(cust);
    aliases.set(id, canonical);
    aliases.set(`id:${id}`, canonical);

    const phone = getBillPhone({ phone: cust.phone });
    if (phone) {
      aliases.set(phoneCanonicalKey(phone), canonical);
      aliases.set(phone, canonical);
    }

    const shop = shopCanonicalKey(cust.shopName || "");
    if (shop) aliases.set(shop, canonical);
  }

  for (const [duplicateId, primaryId] of Object.entries(idAliases)) {
    if (!duplicateId || !primaryId) continue;
    const canonical =
      aliases.get(primaryId) ||
      getCustomerCanonicalKey({ _id: primaryId });
    aliases.set(duplicateId, canonical);
    aliases.set(`id:${duplicateId}`, canonical);
  }

  return aliases;
}

function registerBillIdentityAliases(
  aliases: Map<string, string>,
  info: BillCustomerLike,
  canonical: string
): void {
  const phone = getBillPhone(info);
  if (phone) {
    aliases.set(phoneCanonicalKey(phone), canonical);
    aliases.set(phone, canonical);
  }

  const rawPhone = normalizeCustomerText(info.phone);
  if (rawPhone && !isValidPhone(rawPhone)) {
    aliases.set(phoneCanonicalKey(rawPhone), canonical);
    aliases.set(rawPhone, canonical);
  }

  const customerId = isValidCustomerRef(info.customer)
    ? toRefString(info.customer)
    : "";
  if (customerId) {
    aliases.set(customerId, canonical);
    aliases.set(`id:${customerId}`, canonical);
  }

  const shop = shopCanonicalKey(info.shopName || "");
  if (shop) aliases.set(shop, canonical);

  const snap = makeCustomerSnapshotKey(info);
  if (snap !== "snap::") aliases.set(snap, canonical);
}

/**
 * Link mongo ids, bad phones, and snapshots to one key per shop/phone.
 */
export function buildBillAwareAliasMap(
  customers: CustomerLike[],
  bills: { customerInfo?: BillCustomerLike }[],
  idAliases: Record<string, string> = {}
): Map<string, string> {
  const aliases = buildCustomerAliasMap(customers, idAliases);

  for (const bill of bills) {
    const info = bill.customerInfo;
    if (!info) continue;

    const shop = shopCanonicalKey(info.shopName || "");
    if (!shop) continue;

    const shopCanonical = aliases.get(shop) || shop;
    aliases.set(shop, shopCanonical);
    registerBillIdentityAliases(aliases, info, shopCanonical);
  }

  for (const bill of bills) {
    const info = bill.customerInfo;
    if (!info) continue;

    const phone = getBillPhone(info);
    const shop = shopCanonicalKey(info.shopName || "");
    const customerId = isValidCustomerRef(info.customer)
      ? toRefString(info.customer)
      : "";
    const snap = makeCustomerSnapshotKey(info);

    let canonical = "";
    if (shop && aliases.has(shop)) {
      canonical = aliases.get(shop)!;
    } else if (phone) {
      canonical = phoneCanonicalKey(phone);
    } else if (shop) {
      canonical = shop;
    } else if (customerId) {
      canonical = aliases.get(customerId) || customerId;
    } else if (snap !== "snap::") {
      canonical = aliases.get(snap) || snap;
    } else {
      continue;
    }

    if (shop) aliases.set(shop, canonical);
    registerBillIdentityAliases(aliases, info, canonical);
  }

  for (const cust of customers) {
    const id = normalizeCustomerText(cust._id);
    if (!id) continue;

    const phone = getBillPhone({ phone: cust.phone });
    const shop = shopCanonicalKey(cust.shopName || cust.name || "");

    if (phone) {
      const phoneKey = phoneCanonicalKey(phone);
      aliases.set(id, phoneKey);
      aliases.set(`id:${id}`, phoneKey);
      if (shop) aliases.set(shop, phoneKey);
    } else if (shop) {
      aliases.set(id, shop);
      aliases.set(`id:${id}`, shop);
    }
  }

  return aliases;
}

export function resolveCustomerCanonicalKey(
  info: BillCustomerLike,
  aliases: Map<string, string>
): string {
  const shop = shopCanonicalKey(info.shopName || "");
  if (shop && aliases.has(shop)) {
    return aliases.get(shop)!;
  }

  const phone = getBillPhone(info);
  if (phone) {
    const phoneKey = phoneCanonicalKey(phone);
    return aliases.get(phoneKey) || phoneKey;
  }

  const customerId = isValidCustomerRef(info.customer)
    ? toRefString(info.customer)
    : "";
  if (customerId) {
    if (aliases.has(customerId)) return aliases.get(customerId)!;
    if (aliases.has(`id:${customerId}`)) return aliases.get(`id:${customerId}`)!;
    if (shop) return shop;
    return customerId;
  }

  const snap = makeCustomerSnapshotKey(info);
  if (aliases.has(snap)) return aliases.get(snap)!;

  if (shop) return shop;

  const name = normalizeCustomerText(info.name);
  if (name || snap !== "snap::") return snap;

  return "unknown";
}

export function findDbCustomerIdForCanonical(
  canonical: string,
  customers: CustomerLike[]
): string | undefined {
  const phone = extractPhoneFromCanonical(canonical);
  if (phone && isValidPhone(phone)) {
    const match = customers.find(
      (c) => getBillPhone({ phone: c.phone }) === phone
    );
    return match?._id;
  }

  if (canonical.startsWith("shop:")) {
    const shopNorm = canonical.slice(5);
    const match = customers.find((c) => {
      const shop = normalizeCustomerText(c.shopName).toLowerCase();
      const name = normalizeCustomerText(c.name).toLowerCase();
      return shop === shopNorm || name === shopNorm;
    });
    return match?._id;
  }

  if (/^[a-f0-9]{24}$/i.test(canonical)) {
    return customers.some((c) => c._id === canonical) ? canonical : undefined;
  }

  return undefined;
}

export function getPaymentMergeKey(entry: {
  customerId: string;
  dbId?: string;
  phone?: string;
  shopName?: string;
}): string {
  const shop = shopCanonicalKey(entry.shopName || "");
  if (shop) return shop;

  const displayPhone =
    entry.phone && entry.phone !== "-"
      ? normalizeCustomerText(entry.phone)
      : "";
  if (isValidPhone(displayPhone)) return phoneCanonicalKey(displayPhone);

  const fromCanonical = extractPhoneFromCanonical(entry.customerId);
  if (isValidPhone(fromCanonical)) return phoneCanonicalKey(fromCanonical);

  if (entry.customerId.startsWith("shop:")) return entry.customerId;

  if (fromCanonical && !isValidPhone(fromCanonical)) {
    if (entry.dbId && isValidCustomerRef(entry.dbId)) {
      return `id:${entry.dbId}`;
    }
  }

  if (entry.dbId && isValidCustomerRef(entry.dbId)) {
    return `id:${entry.dbId}`;
  }

  return entry.customerId;
}

export function enrichCustomerAliasMapWithBills(
  customers: CustomerLike[],
  bills: { customerInfo?: BillCustomerLike }[],
  idAliases: Record<string, string> = {}
): Map<string, string> {
  return buildBillAwareAliasMap(customers, bills, idAliases);
}

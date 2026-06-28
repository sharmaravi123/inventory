/** Parse INV-YYYY-NNNNNN (or trailing digits) for stable sorting. */
export function parseInvoiceNumber(invoiceNumber: string): {
  fy: number;
  seq: number;
} {
  const inv = String(invoiceNumber || "").trim();
  const m = inv.match(/^INV-(\d{4})-(\d{6})$/i);
  if (m) {
    return { fy: parseInt(m[1], 10), seq: parseInt(m[2], 10) };
  }
  const tail = inv.match(/(\d+)$/);
  return { fy: 0, seq: tail ? parseInt(tail[1], 10) : 0 };
}

export function isOfficialInvoiceNumber(invoiceNumber: string): boolean {
  return /^INV-\d{4}-\d{6}$/i.test(String(invoiceNumber || "").trim());
}

/** Highest serial first (INV-2026-000106 … 000001). */
export function compareInvoiceNumbersDesc(a: string, b: string): number {
  const ka = parseInvoiceNumber(a);
  const kb = parseInvoiceNumber(b);
  if (ka.fy !== kb.fy) return kb.fy - ka.fy;
  if (ka.seq !== kb.seq) return kb.seq - ka.seq;
  return a.localeCompare(b);
}

/** Lowest serial first (INV-2026-000001 … 000106) — matches bill date order. */
export function compareInvoiceNumbersAsc(a: string, b: string): number {
  return -compareInvoiceNumbersDesc(a, b);
}

export function sortBillsByInvoiceNumber<
  T extends { invoiceNumber?: string | null }
>(bills: T[], direction: "asc" | "desc" = "asc"): T[] {
  const cmp =
    direction === "asc" ? compareInvoiceNumbersAsc : compareInvoiceNumbersDesc;
  return [...bills].sort((a, b) =>
    cmp(String(a.invoiceNumber || ""), String(b.invoiceNumber || ""))
  );
}

/** Latest / highest serial first; falls back to billDate when invoice is temp. */
export function sortBillsForDisplay<
  T extends {
    invoiceNumber?: string | null;
    billDate?: string | Date | null;
    createdAt?: string | Date | null;
  }
>(bills: T[]): T[] {
  return [...bills].sort((a, b) => {
    const invA = String(a.invoiceNumber || "");
    const invB = String(b.invoiceNumber || "");
    const validA = isOfficialInvoiceNumber(invA);
    const validB = isOfficialInvoiceNumber(invB);

    if (validA && validB) {
      return compareInvoiceNumbersDesc(invA, invB);
    }

    const da = new Date(a.billDate || a.createdAt || 0).getTime();
    const db = new Date(b.billDate || b.createdAt || 0).getTime();
    if (da !== db) return db - da;
    return (
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  });
}

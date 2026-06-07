/**
 * Indian financial year label (April–March): 1 Apr YYYY … 31 Mar YYYY+1 → YYYY.
 * Example: 10 Jun 2026 → 2026; 15 Mar 2027 → 2026; 1 Apr 2027 → 2027.
 */
export function getIndianFinancialYearStartYear(d: Date): number {
  const y = d.getFullYear();
  const m = d.getMonth(); // Jan = 0, Apr = 3
  if (m >= 3) return y;
  return y - 1;
}

/** INV-2026-000001 */
export function formatSalesInvoiceNumber(
  financialYearStart: number,
  sequence: number
): string {
  const padded = String(sequence).padStart(6, "0");
  return `INV-${financialYearStart}-${padded}`;
}

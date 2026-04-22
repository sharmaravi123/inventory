type ProductPricingInput = {
  purchasePrice?: number | null;
  sellingPrice?: number | null;
  price?: number | null;
  perBoxItem?: number | null;
};

const toFiniteNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function normalizeInventoryUnitPrices(
  product: ProductPricingInput | null | undefined
): { purchase?: number; selling?: number; perBox: number } {
  const perBoxRaw = toFiniteNumber(product?.perBoxItem);
  const perBox =
    perBoxRaw && perBoxRaw > 0 ? perBoxRaw : 1;

  const selling =
    toFiniteNumber(product?.sellingPrice) ??
    toFiniteNumber(product?.price);

  let purchase =
    toFiniteNumber(product?.purchasePrice) ??
    toFiniteNumber(product?.price);

  // Older product data sometimes stores purchase price as a box rate
  // while selling price is saved per piece. Normalize both to piece rates.
  if (
    purchase !== undefined &&
    selling !== undefined &&
    perBox > 1 &&
    purchase > selling
  ) {
    purchase = purchase / perBox;
  }

  return { purchase, selling, perBox };
}

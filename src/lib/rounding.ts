export const roundGrandTotal = (value: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  // Round to nearest rupee: < .50 down, >= .50 up
  return Math.floor(n + 0.5);
};

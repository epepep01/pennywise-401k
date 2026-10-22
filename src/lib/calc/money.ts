// Preserve cents when they change the meaning of a gap or overshoot.
export function formatDollars(value: number): string {
  const cents = Math.round(value * 100);
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

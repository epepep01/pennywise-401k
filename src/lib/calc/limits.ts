export type AnnualLimit = {
  employeeDeferral: number;
  catchUp50Plus: number;
  catchUp60Through63: number;
  source: string;
};

export const ANNUAL_LIMITS: Record<number, AnnualLimit> = {
  2026: {
    employeeDeferral: 24_500,
    catchUp50Plus: 8_000,
    catchUp60Through63: 11_250,
    source:
      "https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500",
  },
};

export function getAnnualLimit(
  ageAtYearEnd: number,
  limits: AnnualLimit,
): number {
  if (ageAtYearEnd >= 60 && ageAtYearEnd <= 63) {
    return limits.employeeDeferral + limits.catchUp60Through63;
  }

  if (ageAtYearEnd >= 50) {
    return limits.employeeDeferral + limits.catchUp50Plus;
  }

  return limits.employeeDeferral;
}

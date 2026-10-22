import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateContributionPlan, comparePaychecks, contributionAtRate } from "./calculator";
import { createInitialPlan } from "./profiles";

describe("paycheck dollar comparisons", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-21T12:00:00")); });
  afterEach(() => vi.useRealTimers());
  const example = () => ({ ...createInitialPlan(), nextPayDate: "2026-10-30",
    contributionsYtdThisEmployer: 14_200, contributionsYtdOverride: 14_200,
    raises: [], bonuses: [{ id: "bonus", payDate: "2026-12-15", grossAmount: 8_000 }],
  });

  it("compares current and recommended dollars on the same gross paycheck", () => {
    const input = example();
    const plan = calculateContributionPlan(input);
    const comparison = comparePaychecks(input, plan);
    expect(comparison.firstNewPaycheck?.contribution).toBe(1_440);
    expect(comparison.currentRateContribution).toBe(240);
    expect(comparison.changePerPaycheck).toBe(1_200);
    expect(comparison.reference).toMatchObject({ date: "2026-10-16", contribution: 240, isHistoricalEstimate: true });
    expect(plan.contributionEvents).toHaveLength(6);
    expect(plan.projectedTotal).toBe(24_280);
  });

  it("highlights the last delayed paycheck without adding a second reference event", () => {
    const input = { ...example(), updateDelayPaychecks: 2 };
    const plan = calculateContributionPlan(input);
    const comparison = comparePaychecks(input, plan);
    expect(comparison.reference).toMatchObject({ id: plan.contributionEvents[1].id, date: "2026-11-13", isHistoricalEstimate: false });
    expect(comparison.firstNewPaycheck?.date).toBe("2026-11-27");
    expect(plan.contributionEvents).toHaveLength(6);
  });

  it("accounts for a raise without confusing its effect with the rate change", () => {
    const input = { ...example(), raises: [{ id: "raise", effectiveDate: "2026-10-25", annualSalary: 130_000 }] };
    const comparison = comparePaychecks(input, calculateContributionPlan(input));
    expect(comparison.reference?.gross).toBe(4_000);
    expect(comparison.firstNewPaycheck?.gross).toBe(5_000);
    expect(comparison.currentRateContribution).toBe(300);
  });

  it.each([
    ["weekly", "2026-10-30", "2026-10-23"],
    ["biweekly", "2026-10-30", "2026-10-16"],
    ["semimonthly", "2026-11-01", "2026-10-15"],
    ["monthly", "2026-11-30", "2026-10-30"],
  ] as const)("finds the prior %s paycheck", (payFrequency, nextPayDate, expected) => {
    const input = { ...example(), payFrequency, nextPayDate };
    expect(comparePaychecks(input, calculateContributionPlan(input)).reference?.date).toBe(expected);
  });

  it("does not invent a prior deduction when the current percentage is unknown", () => {
    const input = { ...example(), currentContributionRate: null };
    const comparison = comparePaychecks(input, calculateContributionPlan(input));
    expect(comparison.reference).toBeNull();
    expect(comparison.currentRateContribution).toBeNull();
    expect(comparison.firstNewPaycheck).not.toBeNull();
  });

  it("does not invent a new paycheck when all checks are delayed", () => {
    const input = { ...example(), nextPayDate: "2026-12-25", updateDelayPaychecks: 1, bonuses: [] };
    expect(comparePaychecks(input, calculateContributionPlan(input)).firstNewPaycheck).toBeNull();
  });

  it("rounds comparison deductions the same way as the payroll simulation", () => {
    expect(contributionAtRate(1_000.06, 10)).toBe(100.01);
    expect(contributionAtRate(4_000, 0)).toBe(0);
  });
});

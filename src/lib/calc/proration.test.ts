import { describe, expect, it } from "vitest";
import { calculateContributionPlan, comparePaychecks } from "./calculator";
import { createInitialPlan } from "./profiles";
import type { PlannerInput } from "./types";

const example = (overrides: Partial<PlannerInput> = {}): PlannerInput => ({
  ...createInitialPlan(), annualSalary: 120_000, currentContributionRate: 8,
  payFrequency: "semimonthly", semimonthlySchedule: "15th-and-last",
  nextPayDate: "2026-10-31", contributionsYtdThisEmployer: 9_000,
  contributionsYtdOverride: null, raises: [
    { id: "raise", effectiveDate: "2026-10-29", annualSalary: 144_000 },
  ], bonuses: [], ...overrides,
});
const planFor = (input: PlannerInput, asOf = "2026-10-26") =>
  calculateContributionPlan(input, 10, asOf);

describe("raises within estimated earning periods", () => {
  it("does not call a future October 29 raise already effective", () => {
    const plan = planFor(example());
    expect(plan.errors).toEqual([]);
    expect(plan.issues.filter(issue => issue.field === "raise-date-raise")).toEqual([]);
    // Oct 16–28: 13 days at $5,000; Oct 29–31: 3 days at $6,000.
    expect(plan.contributionEvents[0]).toMatchObject({ gross: 5_187.5, contribution: 518.75 });
    expect(plan.contributionEvents[1].gross).toBe(6_000);
  });

  it.each([
    ["weekly", 104_000, 130_000, "2026-10-30", 2_142.86],
    ["biweekly", 104_000, 130_000, "2026-10-30", 4_142.86],
    ["monthly", 120_000, 144_000, "2026-10-31", 10_193.55],
  ] as const)("prorates a %s check and rounds only the final gross", (payFrequency, annualSalary, newSalary, nextPayDate, gross) => {
    const plan = planFor(example({ payFrequency, annualSalary, nextPayDate,
      raises: [{ id: "raise", effectiveDate: "2026-10-29", annualSalary: newSalary }],
    }));
    expect(plan.errors).toEqual([]);
    expect(plan.contributionEvents[0].gross).toBe(gross);
  });

  it("handles the 1st/15th schedule across a month boundary", () => {
    expect(planFor(example({ nextPayDate: "2026-11-01", semimonthlySchedule: "1st-and-15th" }))
      .contributionEvents[0].gross).toBe(5_235.29);
  });

  it.each([
    ["2026-10-15", 6_000],
    ["2026-10-16", 6_000],
    ["2026-10-31", 5_062.5],
    ["2026-11-01", 5_000],
  ])("treats the effective date %s as the first day at the new salary", (effectiveDate, gross) => {
    expect(planFor(example({ raises: [{ id: "raise", effectiveDate, annualSalary: 144_000 }] }))
      .contributionEvents[0].gross).toBe(gross);
  });

  it("handles two raises in one period regardless of input order", () => {
    const plan = planFor(example({ raises: [
      { id: "later", effectiveDate: "2026-10-29", annualSalary: 168_000 },
      { id: "earlier", effectiveDate: "2026-10-20", annualSalary: 144_000 },
    ] }));
    expect(plan.contributionEvents[0].gross).toBe(5_937.5);
    expect(plan.contributionEvents[1].gross).toBe(7_000);
  });

  it("uses the monthly anchor when February clips a month-end payday", () => {
    const plan = planFor(example({ payFrequency: "monthly", nextPayDate: "2026-01-31",
      raises: [{ id: "raise", effectiveDate: "2026-02-15", annualSalary: 144_000 }],
    }), "2026-01-01");
    expect(plan.contributionEvents[1]).toMatchObject({ date: "2026-02-28", gross: 11_000 });
    expect(plan.contributionEvents[2].gross).toBe(12_000);
  });

  it("does not warn about YTD for a raise in the current unpaid period", () => {
    const plan = planFor(example(), "2026-10-30");
    expect(plan.issues.filter(issue => issue.field === "raise-date-raise")).toEqual([]);
    expect(plan.contributionEvents[0].gross).toBe(5_187.5);
  });

  it("keeps optional actual-YTD guidance when a past raise affected paid checks", () => {
    for (const contributionsYtdOverride of [null, 9_000]) {
      const plan = planFor(example({ contributionsYtdOverride,
        raises: [{ id: "past", effectiveDate: "2026-10-01", annualSalary: 144_000 }],
      }));
      expect(plan.issues.find(issue => issue.field === "raise-date-past")?.severity).toBe("warning");
      expect(plan.errors).toEqual([]);
    }
  });

  it("prorates salary independently of a delayed contribution election", () => {
    const plan = planFor(example({ updateDelayPaychecks: 1 }));
    expect(plan.contributionEvents[0]).toMatchObject({ gross: 5_187.5, rate: 8, contribution: 415 });
    expect(plan.contributionEvents[1]).toMatchObject({ gross: 6_000, rate: 10, contribution: 600 });
  });

  it("keeps a future bonus before next payday whole and at the delayed current rate", () => {
    const plan = planFor(example({ updateDelayPaychecks: 1,
      bonuses: [{ id: "bonus", payDate: "2026-10-29", grossAmount: 8_000 }],
    }));
    expect(plan.contributionEvents[0]).toMatchObject({ id: "bonus", gross: 8_000, contribution: 640 });
    expect(plan.warnings.join(" ")).not.toContain("date has passed");
  });

  it("uses prorated gross in comparison cards and historical reference rows", () => {
    const input = example({ nextPayDate: "2026-11-15" });
    const plan = planFor(input, "2026-11-01");
    const comparison = comparePaychecks(input, plan);
    expect(comparison.reference?.gross).toBe(5_187.5);
    expect(comparison.firstNewPaycheck?.gross).toBe(6_000);
  });

  it("keeps the recommended cent-rounded projection within the target", () => {
    const input = example({ goalType: "target", targetAmount: 12_000 });
    const plan = calculateContributionPlan(input, undefined, "2026-10-26");
    expect(plan.projectedTotal).toBeLessThanOrEqual(12_000);
    expect(plan.nextRateOvershoot).toBeGreaterThan(0);
  });
});

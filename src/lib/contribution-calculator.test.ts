import { describe, expect, it } from "vitest";
import {
  calculateContributionPlan,
  type ContributionInput,
} from "./contribution-calculator";

const baseInput: ContributionInput = {
  ageAtYearEnd: 35,
  annualSalary: 120_000,
  annualSalaryAfterRaise: 126_000,
  raiseEffectiveDate: "2026-11-01",
  nextPayDate: "2026-10-23",
  payFrequency: "biweekly",
  semimonthlySchedule: "1st-and-15th",
  bonusAmount: 5_000,
  bonusPayDate: "2026-12-04",
  contributionsYtd: 12_000,
  currentContributionRate: 6,
  updateDelayPaychecks: 1,
  goalType: "target",
  targetAmount: 20_000,
};

describe("calculateContributionPlan", () => {
  it("uses the 2026 IRS employee limit and age-based catch-up amounts", () => {
    expect(
      calculateContributionPlan({
        ...baseInput,
        goalType: "max",
        ageAtYearEnd: 35,
      }).legalLimit,
    ).toBe(24_500);
    expect(
      calculateContributionPlan({
        ...baseInput,
        goalType: "max",
        ageAtYearEnd: 50,
      }).legalLimit,
    ).toBe(32_500);
    expect(
      calculateContributionPlan({
        ...baseInput,
        goalType: "max",
        ageAtYearEnd: 60,
      }).legalLimit,
    ).toBe(35_750);
  });

  it("counts remaining biweekly checks and includes a raise and future bonus", () => {
    const plan = calculateContributionPlan(baseInput);

    expect(plan.paychecksRemaining).toBe(5);
    expect(plan.remainingEligibleCompensation).toBeCloseTo(29_000, 0);
    expect(plan.recommendedRate).toBe(32);
    expect(plan.projectedAnnualContribution).toBeCloseTo(20_080, 0);
  });

  it("counts twice-monthly dates through year end", () => {
    const plan = calculateContributionPlan({
      ...baseInput,
      payFrequency: "semimonthly",
      semimonthlySchedule: "1st-and-15th",
      nextPayDate: "2026-10-15",
      raiseEffectiveDate: null,
      bonusAmount: 0,
      bonusPayDate: null,
    });

    expect(plan.paychecksRemaining).toBe(5);
    expect(plan.errors).toEqual([]);
  });

  it("counts weekly and monthly paychecks through year end", () => {
    const weeklyPlan = calculateContributionPlan({
      ...baseInput,
      payFrequency: "weekly",
      nextPayDate: "2026-10-23",
      raiseEffectiveDate: null,
      bonusAmount: 0,
      bonusPayDate: null,
    });
    const monthlyPlan = calculateContributionPlan({
      ...baseInput,
      payFrequency: "monthly",
      nextPayDate: "2026-10-31",
      raiseEffectiveDate: null,
      bonusAmount: 0,
      bonusPayDate: null,
    });

    expect(weeklyPlan.paychecksRemaining).toBe(10);
    expect(monthlyPlan.paychecksRemaining).toBe(3);
  });

  it("keeps the current rate for delayed paychecks before applying the new rate", () => {
    const delayedPlan = calculateContributionPlan({
      ...baseInput,
      bonusAmount: 0,
      bonusPayDate: null,
      updateDelayPaychecks: 1,
    });
    const immediatePlan = calculateContributionPlan({
      ...baseInput,
      bonusAmount: 0,
      bonusPayDate: null,
      updateDelayPaychecks: 0,
    });

    expect(delayedPlan.recommendedRate).toBeGreaterThan(
      immediatePlan.recommendedRate,
    );
    expect(delayedPlan.projectedAnnualContribution).toBeGreaterThanOrEqual(
      delayedPlan.goalAmount,
    );
  });

  it("reports when even a 100% rate cannot reach the selected target", () => {
    const plan = calculateContributionPlan({
      ...baseInput,
      annualSalary: 0,
      annualSalaryAfterRaise: 0,
      raiseEffectiveDate: null,
      bonusAmount: 0,
      bonusPayDate: null,
      contributionsYtd: 10_000,
      targetAmount: 20_000,
    });

    expect(plan.goalAchievable).toBe(false);
    expect(plan.recommendedRate).toBe(100);
    expect(plan.projectedAnnualContribution).toBe(10_000);
  });

  it("rejects dates that do not match the selected twice-monthly schedule", () => {
    const plan = calculateContributionPlan({
      ...baseInput,
      payFrequency: "semimonthly",
      nextPayDate: "2026-10-23",
    });

    expect(plan.errors).toContain(
      "For twice-monthly pay, choose a next paycheck date matching the selected schedule.",
    );
  });

  it("does not project employee contributions beyond the IRS limit", () => {
    const plan = calculateContributionPlan(
      {
        ...baseInput,
        goalType: "max",
        contributionsYtd: 24_000,
        bonusAmount: 0,
        bonusPayDate: null,
      },
      100,
    );

    expect(plan.projectedAnnualContribution).toBe(24_500);
  });
});

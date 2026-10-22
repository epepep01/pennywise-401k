import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateContributionPlan } from "./calculator";
import { createInitialPlan, createProfile, parseProfiles } from "./profiles";

describe("fixed-rate planning regressions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T12:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  const example = () => ({
    ...createInitialPlan(),
    currentContributionRate: 6,
    contributionsYtdThisEmployer: 14_200,
    contributionsYtdOverride: 14_200,
    raises: [],
    bonuses: [{ id: "bonus", payDate: "2026-12-15", grossAmount: 8_000 }],
  });

  it("checks rounded deductions before recommending a rate", () => {
    const plan = calculateContributionPlan({
      ...example(), annualSalary: 26_001.56,
      contributionsYtdThisEmployer: 0, goalType: "target",
      targetAmount: 500.03, bonuses: [],
    });
    expect(plan.recommendedRate).toBe(9);
    expect(plan.projectedTotal).toBe(450.05);
    expect(plan.projectedTotal).toBeLessThanOrEqual(plan.goalAmount);
    expect(plan.nextRateOvershoot).toBe(0.02);
  });

  it("shows the uncapped total when trying a rate above the legal goal", () => {
    const recommendation = calculateContributionPlan(example());
    const comparison = calculateContributionPlan(example(), 37);
    expect(recommendation.recommendedRate).toBe(36);
    expect(recommendation.projectedTotal).toBe(24_280);
    expect(comparison.projectedTotal).toBe(24_560);
    expect(comparison.contributionEvents.at(-1)?.yearToDate).toBe(24_560);
    expect(comparison.recommendedRate).toBe(36);
  });

  it("does not assume a new employer stops at a combined remaining limit", () => {
    const plan = calculateContributionPlan({
      ...example(), contributionsYtdThisEmployer: 10_000,
      contributionsYtdOtherEmployers: 4_200,
    }, 37);
    expect(plan.projectedTotal).toBe(24_560);
  });

  it("counts partial match lost on the final paycheck under a payroll cutoff", () => {
    const plan = calculateContributionPlan({
      ...example(), nextPayDate: "2026-12-25",
      contributionsYtdThisEmployer: 24_499, bonuses: [], planHasTrueUp: false,
      employerMatch: { employerMatchPercent: 100, employeeContributionCapPercent: 4 },
    }, 4);
    expect(plan.estimatedLostMatch).toBe(159);
    expect(plan.matchAtRisk).toBe(true);
  });

  it("does not assert lost match when true-up rules are unknown", () => {
    const plan = calculateContributionPlan({
      ...example(), contributionsYtdThisEmployer: 24_499,
      planHasTrueUp: null,
      employerMatch: { employerMatchPercent: 100, employeeContributionCapPercent: 4 },
    }, 4);
    expect(plan.matchAtRisk).toBe(false);
    expect(plan.warnings.join(" ")).toContain("true-up");
  });

  it("requires a current rate when a change will be delayed", () => {
    const plan = calculateContributionPlan({
      ...example(), currentContributionRate: null, updateDelayPaychecks: 1,
    });
    expect(plan.recommendedRate).toBeNull();
    expect(plan.errors.join(" ")).toContain("Current contribution rate");
  });

  it("flags a stale next payday rather than forecasting already-paid checks", () => {
    const plan = calculateContributionPlan({ ...example(), nextPayDate: "2026-10-16" });
    expect(plan.recommendedRate).toBeNull();
    expect(plan.errors.join(" ")).toContain("Next pay date has passed");
  });

  it("explains when delayed deductions make staying under the target impossible", () => {
    const plan = calculateContributionPlan({
      ...example(), goalType: "target", targetAmount: 14_300,
      updateDelayPaychecks: 1, bonuses: [],
    });
    expect(plan.recommendedRate).toBe(0);
    expect(plan.projectedTotal).toBe(14_440);
    expect(plan.warnings.join(" ")).toContain("already scheduled");
  });

  it("rejects comparison rates above a confirmed plan cap", () => {
    const plan = calculateContributionPlan({ ...example(), planMaxPercent: 20 }, 21);
    expect(plan.errors.join(" ")).toContain("plan maximum");
  });

  it("defaults new plans to unknown true-up and preserves saved confirmed rules", () => {
    expect(createInitialPlan().planHasTrueUp).toBeNull();
    const profile = createProfile("Alex");
    profile.plan.planHasTrueUp = false;
    expect(parseProfiles(JSON.stringify([profile]))[0].plan.planHasTrueUp).toBe(false);
  });
  it("keeps the existing-rate schedule when no new rate can take effect", () => {
    const plan = calculateContributionPlan({
      ...example(), nextPayDate: "2026-12-25", updateDelayPaychecks: 1, bonuses: [],
    });
    expect(plan.recommendedRate).toBeNull();
    expect(plan.contributionEvents).toHaveLength(1);
    expect(plan.contributionEvents[0].rate).toBe(6);
    expect(plan.projectedTotal).toBe(14_440);
  });

  it.each([0, 1, 123.45, 500.03, 1_000.01, 5_000, 24_500])("stays within a target of $%s when a safe rate exists", targetAmount => {
    const input = { ...example(), annualSalary: 26_001.56,
      contributionsYtdThisEmployer: 0, bonuses: [], goalType: "target" as const, targetAmount };
    const plan = calculateContributionPlan(input);
    expect(plan.projectedTotal).toBeLessThanOrEqual(targetAmount);
    if (plan.nextRate !== null) {
      expect(calculateContributionPlan(input, plan.nextRate).projectedTotal).toBeGreaterThan(targetAmount);
    }
  });

});

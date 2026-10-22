import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateContributionPlan,
  derivePaychecksPassed,
  derivePaychecksRemaining,
  deriveYtdContributionEstimate,
} from "./calculator";
import type { PlannerInput } from "./types";

const workedExample: PlannerInput = {
  taxYear: 2026,
  ageAtYearEnd: 35,
  annualSalary: 104_000,
  payFrequency: "biweekly",
  nextPayDate: "2026-10-30",
  semimonthlySchedule: "1st-and-15th",
  contributionsYtdThisEmployer: 14_200,
  contributionsYtdOverride: null,
  contributionsYtdOtherEmployers: 0,
  currentContributionRate: null,
  updateDelayPaychecks: 0,
  goalType: "max",
  targetAmount: 0,
  planMaxPercent: null,
  raises: [],
  bonuses: [
    { id: "bonus-1", payDate: "2026-12-15", grossAmount: 8_000 },
  ],
  employerMatch: null,
  planHasTrueUp: false,
};

describe("calculateContributionPlan", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T12:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["weekly", "2026-12-04", 48],
    ["biweekly", "2026-12-04", 24],
    ["semimonthly", "2026-12-01", 22],
    ["monthly", "2026-10-31", 9],
  ] as const)("derives past and remaining %s paychecks from the selected date", (
    payFrequency,
    nextPayDate,
    pastCount,
  ) => {
    const input = {
      ...workedExample,
      payFrequency,
      nextPayDate,
      currentContributionRate: 10,
      bonuses: [],
    };
    const estimated = deriveYtdContributionEstimate(input);
    const perCheck = Math.round(
      ((input.annualSalary / {
        weekly: 52,
        biweekly: 26,
        semimonthly: 24,
        monthly: 12,
      }[payFrequency]) *
        0.1 +
        Number.EPSILON) *
        100,
    ) / 100;
    const expected = Math.round(perCheck * pastCount * 100) / 100;

    expect(derivePaychecksPassed(input)).toBe(pastCount);
    expect(estimated).toBe(expected);
    expect(derivePaychecksRemaining(input)).toBe(
      calculateContributionPlan(input).paychecksRemaining,
    );
  });

  it("matches the design brief worked example, including next-rate overshoot", () => {
    const plan = calculateContributionPlan(workedExample);

    expect(plan.errors).toEqual([]);
    expect(plan.recommendedRate).toBe(36);
    expect(plan.contributionEvents.map((event) => event.contribution)).toEqual([
      1_440, 1_440, 1_440, 1_440, 2_880, 1_440,
    ]);
    expect(plan.projectedTotal).toBe(24_280);
    expect(plan.gap).toBe(220);
    expect(plan.nextRate).toBe(37);
    expect(plan.nextRateOvershoot).toBe(60);
  });

  it("ignores blank optional raise and bonus rows", () => {
    const input: PlannerInput = {
      ...workedExample,
      raises: [{ id: "blank-raise", effectiveDate: "", annualSalary: null }],
      bonuses: [{ id: "blank-bonus", payDate: "", grossAmount: null }],
    };

    const plan = calculateContributionPlan(input);

    expect(plan.errors).toEqual([]);
    expect(plan.warnings).toEqual([]);
    expect(plan.contributionEvents.some((event) => event.id === "blank-bonus"))
      .toBe(false);
  });

  it("reports partially completed optional raise and bonus rows", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      raises: [{ id: "partial-raise", effectiveDate: "", annualSalary: 120_000 }],
      bonuses: [{ id: "partial-bonus", payDate: "", grossAmount: 1_000 }],
    });

    expect(plan.errors).toContain(
      "Every raise needs a valid date in the selected tax year.",
    );
    expect(plan.errors).toContain(
      "Every bonus needs a valid pay date in the selected tax year.",
    );
  });

  it("recommends zero when contributions already meet the MAX goal", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      contributionsYtdThisEmployer: 24_500,
      bonuses: [],
    });

    expect(plan.recommendedRate).toBe(0);
    expect(plan.projectedTotal).toBe(24_500);
  });

  it("recommends zero when year-to-date contributions meet a target", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      contributionsYtdThisEmployer: 15_000,
      goalType: "target",
      targetAmount: 15_000,
      bonuses: [],
    });

    expect(plan.recommendedRate).toBe(0);
    expect(plan.gap).toBe(0);
  });

  it("caps a recommendation at the plan maximum and reports the shortfall", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      planMaxPercent: 20,
    });

    expect(plan.recommendedRate).toBe(20);
    expect(plan.projectedTotal).toBe(19_800);
    expect(plan.gap).toBe(4_700);
    expect(plan.warnings.join(" ")).toContain("plan maximum of 20%");
  });

  it("applies multiple raises to the paychecks on and after their dates", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      annualSalary: 104_000,
      raises: [
        { id: "raise-1", effectiveDate: "2026-11-01", annualSalary: 130_000 },
      ],
      bonuses: [],
    });

    expect(plan.contributionEvents.map((event) => event.gross)).toEqual([
      4_000, 5_000, 5_000, 5_000, 5_000,
    ]);
  });

  it.each([
    ["weekly", "2026-12-04", 4],
    ["biweekly", "2026-12-04", 2],
    ["semimonthly", "2026-12-01", 2],
    ["monthly", "2026-10-31", 3],
  ] as const)("builds the remaining %s schedule", (payFrequency, nextPayDate, count) => {
    const plan = calculateContributionPlan({
      ...workedExample,
      payFrequency,
      nextPayDate,
      bonuses: [],
      contributionsYtdThisEmployer: 0,
      goalType: "target",
      targetAmount: 1_000,
    });

    expect(plan.paychecksRemaining).toBe(count);
  });

  it.each([
    [49, 24_500],
    [50, 32_500],
    [60, 35_750],
    [63, 35_750],
    [64, 32_500],
  ])("applies the age %i annual limit", (age, expectedLimit) => {
    expect(
      calculateContributionPlan({
        ...workedExample,
        ageAtYearEnd: age,
        contributionsYtdThisEmployer: 0,
      }).legalLimit,
    ).toBe(expectedLimit);
  });

  it("includes contributions at other employers in the shared annual limit", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      contributionsYtdThisEmployer: 10_000,
      contributionsYtdOtherEmployers: 4_200,
    });

    expect(plan.recommendedRate).toBe(36);
    expect(plan.projectedTotal).toBe(24_280);
  });

  it("reports no paychecks and no rate when the next payday is in the following year", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      nextPayDate: "2027-01-01",
      bonuses: [],
    });

    expect(plan.paychecksRemaining).toBe(0);
    expect(plan.recommendedRate).toBeNull();
    expect(plan.contributionEvents).toEqual([]);
  });

  it("rejects a twice-monthly next payday that does not match the selected pattern", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      payFrequency: "semimonthly",
      nextPayDate: "2026-10-30",
    });

    expect(plan.errors).toContain(
      "Next pay date does not match your twice-monthly schedule.",
    );
    expect(plan.recommendedRate).toBeNull();
  });

  it("rejects an update delay above three paychecks", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      updateDelayPaychecks: 4,
    });

    expect(plan.errors).toContain(
      "Update delay must be 0, 1, 2, or 3 paychecks.",
    );
  });

  it("shows no rate when the year-to-date goal is met and no paychecks remain", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      nextPayDate: "2027-01-01",
      contributionsYtdThisEmployer: 24_500,
      bonuses: [],
    });

    expect(plan.recommendedRate).toBeNull();
  });

  it("estimates all paid checks when the next payday is in the following year", () => {
    const input = {
      ...workedExample,
      nextPayDate: "2027-01-01",
      currentContributionRate: 6,
      bonuses: [],
    };

    expect(derivePaychecksPassed(input)).toBeGreaterThan(0);
    expect(derivePaychecksRemaining(input)).toBe(0);
    expect(deriveYtdContributionEstimate(input)).toBeGreaterThan(0);
  });

  it("keeps contribution totals rounded to cents", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      annualSalary: 100,
      payFrequency: "weekly",
      nextPayDate: "2026-12-11",
      contributionsYtdThisEmployer: 0,
      goalType: "target",
      targetAmount: 1,
      bonuses: [],
    });

    expect(plan.contributionEvents.reduce((sum, event) => sum + event.contribution, 0))
      .toBeCloseTo(plan.projectedTotal, 2);
    expect(
      plan.contributionEvents.every(
        (event) => Number.isInteger(event.contribution * 100),
      ),
    ).toBe(true);
  });

  it("accounts for contribution-update delay and current rate", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      currentContributionRate: 6,
      updateDelayPaychecks: 1,
      bonuses: [],
    });

    expect(plan.paychecksAtCurrentRate).toBe(1);
    expect(plan.contributionEvents[0].rate).toBe(6);
    expect(plan.eligibleGross).toBe(16_000);
    expect(plan.recommendedRate).toBe(62);
  });

  it("reports when delayed contributions at the current rate will exceed a target", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      contributionsYtdThisEmployer: 14_900,
      currentContributionRate: 6,
      updateDelayPaychecks: 1,
      goalType: "target",
      targetAmount: 15_000,
      bonuses: [],
    });

    expect(plan.recommendedRate).toBe(0);
    expect(plan.projectedTotal).toBe(15_140);
    expect(plan.projectedTotal - plan.goalAmount).toBe(140);
  });

  it("warns when a bonus date has passed and leaves it out of the projection", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T12:00:00"));
    const plan = calculateContributionPlan({
      ...workedExample,
      bonuses: [
        { id: "paid-bonus", payDate: "2026-10-15", grossAmount: 1_000 },
      ],
    });

    expect(plan.warnings.join(" ")).toContain("date has passed");
    expect(plan.contributionEvents.some((event) => event.id === "paid-bonus"))
      .toBe(false);
  });

  it("projects a future bonus separately even when it is before the next regular paycheck", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T12:00:00"));
    const plan = calculateContributionPlan({
      ...workedExample,
      nextPayDate: "2026-10-30",
      currentContributionRate: 6,
      updateDelayPaychecks: 0,
      bonuses: [
        { id: "off-cycle-bonus", payDate: "2026-10-25", grossAmount: 1_000 },
      ],
    }, 10);

    const bonusEvent = plan.contributionEvents.find(
      (event) => event.id === "off-cycle-bonus",
    );
    expect(bonusEvent).toMatchObject({
      date: "2026-10-25",
      type: "bonus",
      gross: 1_000,
      rate: 10,
      contribution: 100,
    });
    expect(plan.warnings.join(" ")).toContain(
      "projected as a separate payment",
    );
  });

  it("can recommend a rate for an upcoming bonus when no regular paychecks remain", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-20T12:00:00"));
    const plan = calculateContributionPlan({
      ...workedExample,
      nextPayDate: "2027-01-01",
      contributionsYtdThisEmployer: 20_000,
      currentContributionRate: 0,
      updateDelayPaychecks: 0,
      bonuses: [
        { id: "year-end-bonus", payDate: "2026-12-25", grossAmount: 5_000 },
      ],
    });

    expect(plan.paychecksRemaining).toBe(0);
    expect(plan.recommendedRate).toBe(90);
    expect(
      plan.contributionEvents.find((event) => event.id === "year-end-bonus")
        ?.contribution,
    ).toBe(4_500);
  });

  it("applies a raise to gross pay immediately, even while the contribution rate is delayed", () => {
    const input = {
      ...workedExample,
      payFrequency: "weekly" as const,
      nextPayDate: "2026-11-06",
      contributionsYtdThisEmployer: 0,
      currentContributionRate: 6,
      updateDelayPaychecks: 2,
      bonuses: [],
    };
    const raiseBeforeFirstPaycheck = calculateContributionPlan(
      {
        ...input,
        raises: [
          { id: "raise", effectiveDate: "2026-11-01", annualSalary: 130_000 },
        ],
      },
      6,
    );
    const raiseAfterFirstPaycheck = calculateContributionPlan(
      {
        ...input,
        raises: [
          { id: "raise", effectiveDate: "2026-11-20", annualSalary: 130_000 },
        ],
      },
      6,
    );

    expect(raiseBeforeFirstPaycheck.contributionEvents[0].rate).toBe(6);
    expect(raiseBeforeFirstPaycheck.contributionEvents[0].gross).toBe(2_500);
    expect(raiseBeforeFirstPaycheck.contributionEvents[0].contribution).toBe(150);
    expect(raiseAfterFirstPaycheck.contributionEvents[0].gross).toBe(2_000);
    expect(raiseAfterFirstPaycheck.contributionEvents[0].contribution).toBe(120);
    expect(raiseBeforeFirstPaycheck.projectedTotal).toBeGreaterThan(
      raiseAfterFirstPaycheck.projectedTotal,
    );
    expect(raiseBeforeFirstPaycheck.projectedAtCurrentRate).toBeGreaterThan(
      raiseAfterFirstPaycheck.projectedAtCurrentRate ?? 0,
    );
  });

  it("uses the current or new rate for a bonus based on its date and contribution delay", () => {
    const input = {
      ...workedExample,
      payFrequency: "weekly" as const,
      nextPayDate: "2026-11-06",
      contributionsYtdThisEmployer: 0,
      currentContributionRate: 6,
      updateDelayPaychecks: 1,
    };
    const bonusBeforeNewRate = calculateContributionPlan(
      {
        ...input,
        bonuses: [
          { id: "bonus", payDate: "2026-11-06", grossAmount: 1_000 },
        ],
      },
      10,
    );
    const bonusOnNewRateDate = calculateContributionPlan(
      {
        ...input,
        bonuses: [
          { id: "bonus", payDate: "2026-11-13", grossAmount: 1_000 },
        ],
      },
      10,
    );

    expect(
      bonusBeforeNewRate.contributionEvents.find((event) => event.id === "bonus")
        ?.rate,
    ).toBe(6);
    expect(
      bonusOnNewRateDate.contributionEvents.find((event) => event.id === "bonus")
        ?.rate,
    ).toBe(10);
    expect(bonusOnNewRateDate.projectedTotal).toBeGreaterThan(
      bonusBeforeNewRate.projectedTotal,
    );
    expect(
      bonusOnNewRateDate.projectedTotal - bonusBeforeNewRate.projectedTotal,
    ).toBe(40);
  });

  it("warns when every remaining paycheck falls within the contribution delay", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      payFrequency: "weekly",
      nextPayDate: "2026-12-29",
      updateDelayPaychecks: 3,
      bonuses: [],
    });

    expect(plan.paychecksRemaining).toBe(1);
    expect(plan.recommendedRate).toBeNull();
    expect(plan.warnings).toContain(
      "All remaining paychecks will use your current contribution rate; no paycheck will receive the new rate.",
    );
  });

  it("labels a raise that is already effective", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      contributionsYtdOverride: null,
      raises: [
        { id: "past-raise", effectiveDate: "2026-10-15", annualSalary: 110_000 },
      ],
    });

    expect(plan.warnings.join(" ")).toContain("excludes past raises");
  });

  it("errors when combined year-to-date contributions exceed the limit", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      contributionsYtdThisEmployer: 20_000,
      contributionsYtdOtherEmployers: 5_000,
    });

    expect(plan.errors.join(" ")).toContain("Over the limit");
  });

  it("caps a target at the legal employee limit", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      goalType: "target",
      targetAmount: 30_000,
      contributionsYtdThisEmployer: 0,
    });

    expect(plan.goalAmount).toBe(24_500);
    expect(plan.warnings.join(" ")).toContain("goal is capped");
  });

  it("shows the estimated match at risk when there is no true-up", () => {
    const plan = calculateContributionPlan({
      ...workedExample,
      annualSalary: 500_000,
      contributionsYtdThisEmployer: 24_000,
      employerMatch: {
        employerMatchPercent: 100,
        employeeContributionCapPercent: 4,
      },
      planHasTrueUp: false,
      bonuses: [],
    }, 100);

    expect(plan.matchAtRisk).toBe(true);
    expect(plan.estimatedLostMatch).toBeGreaterThan(0);
    expect(plan.warnings.join(" ")).toContain("Match at risk");
  });
});

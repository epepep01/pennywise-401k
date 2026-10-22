import { describe, expect, it } from "vitest";
import { calculateContributionPlan } from "./calculator";
import {
  createInitialPlan,
  createProfile,
  parseProfiles,
} from "./profiles";
import { deriveYtdContributionEstimate } from "./calculator";

describe("local planner profiles", () => {
  it("prefills a fictional plan and estimates year-to-date contributions", () => {
    const input = createInitialPlan();
    const estimatedYtd = deriveYtdContributionEstimate(input);
    const plan = calculateContributionPlan({
      ...input,
      contributionsYtdThisEmployer: estimatedYtd,
    });

    expect(input.contributionsYtdOverride).toBeNull();
    expect(input.raises).toHaveLength(1);
    expect(input.raises[0]).toMatchObject({
      effectiveDate: "",
      annualSalary: null,
    });
    expect(input.bonuses).toHaveLength(1);
    expect(input.bonuses[0]).toMatchObject({
      payDate: input.nextPayDate,
      grossAmount: null,
    });
    expect(plan.ytdTotal).toBe(estimatedYtd);
    expect(plan.recommendedRate).not.toBeNull();
  });

  it("round-trips a profile with a complete planner input", () => {
    const profile = createProfile("Alex");

    expect(parseProfiles(JSON.stringify([profile]))).toEqual([profile]);
  });

  it("rejects invalid or incomplete saved profile data", () => {
    expect(() => parseProfiles("{")).toThrow();
    expect(() =>
      parseProfiles(
        JSON.stringify([
          {
            id: "broken",
            name: "Broken",
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
            plan: {},
          },
        ]),
      ),
    ).toThrow("A saved profile is incomplete");
  });

  it("keeps the previous saved year-to-date amount as an explicit override", () => {
    const profile = createProfile("Alex");
    const legacyProfile = {
      ...profile,
      plan: {
        ...profile.plan,
        contributionsYtdThisEmployer: 14_200,
          contributionsYtdOverride: undefined,
          paychecksRemainingOverride: 5,
      },
    };

    const [migrated] = parseProfiles(JSON.stringify([legacyProfile]));

    expect(migrated.plan.contributionsYtdOverride).toBe(14_200);
    expect("paychecksRemainingOverride" in migrated.plan).toBe(false);
  });
});

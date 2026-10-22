import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateContributionPlan } from "./calculator";
import { createInitialPlan } from "./profiles";
import { fieldMessage, sectionErrorCount } from "./validation";

describe("validation beside the input that can fix it", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-21T12:00:00")); });
  afterEach(() => vi.useRealTimers());
  const input = () => ({ ...createInitialPlan(), nextPayDate: "2026-10-30", raises: [], bonuses: [] });

  it("targets the particular raise date without flagging other raise rows", () => {
    const plan = calculateContributionPlan({ ...input(), raises: [
      { id: "valid", effectiveDate: "2026-11-01", annualSalary: 110_000 },
      { id: "missing-date", effectiveDate: "", annualSalary: 120_000 },
    ] });
    expect(fieldMessage(plan.issues, "raise-date-missing-date", "error")).toContain("valid date");
    expect(fieldMessage(plan.issues, "raise-date-valid", "error")).toBeUndefined();
    expect(sectionErrorCount(plan.issues, ["raise-*"])).toBe(1);
  });

  it("targets bonus date and amount independently", () => {
    const plan = calculateContributionPlan({ ...input(), bonuses: [
      { id: "wrong-year", payDate: "2027-12-01", grossAmount: 100 },
      { id: "negative", payDate: "2026-12-01", grossAmount: -1 },
    ] });
    expect(fieldMessage(plan.issues, "bonus-date-wrong-year", "error")).toContain("selected tax year");
    expect(fieldMessage(plan.issues, "bonus-amount-negative", "error")).toContain("zero or more");
    expect(fieldMessage(plan.issues, "bonus-date-negative", "error")).toBeUndefined();
  });

  it("places past-bonus guidance on that bonus's date", () => {
    const plan = calculateContributionPlan({ ...input(), bonuses: [
      { id: "paid", payDate: "2026-10-01", grossAmount: 500 },
    ] });
    expect(fieldMessage(plan.issues, "bonus-date-paid", "warning")).toContain("Include its contributions");
    expect(sectionErrorCount(plan.issues, ["bonus-*"])).toBe(0);
  });

  it("points to the invalid half of a match formula", () => {
    const plan = calculateContributionPlan({ ...input(), employerMatch: {
      employerMatchPercent: 101, employeeContributionCapPercent: 4,
    } });
    expect(fieldMessage(plan.issues, "employer-match-percent", "error")).toBeDefined();
    expect(fieldMessage(plan.issues, "match-cap-percent", "error")).toBeUndefined();
  });

  it("puts unknown true-up guidance next to the true-up dropdown", () => {
    const plan = calculateContributionPlan({ ...input(), employerMatch: {
      employerMatchPercent: 100, employeeContributionCapPercent: 4,
    }, planHasTrueUp: null });
    expect(fieldMessage(plan.issues, "true-up", "warning")).toContain("unknown");
  });

  it("places a combined-limit error at the YTD summary, not an unrelated employer field", () => {
    const plan = calculateContributionPlan({ ...input(), contributionsYtdThisEmployer: 25_000 });
    expect(fieldMessage(plan.issues, "ytd-summary", "error")).toContain("Over the limit");
    expect(fieldMessage(plan.issues, "ytd-other-employers", "error")).toBeUndefined();
  });

  it("points a missing delayed-election rate to the current-percentage input", () => {
    const plan = calculateContributionPlan({ ...input(), currentContributionRate: null, updateDelayPaychecks: 1 });
    expect(fieldMessage(plan.issues, "current-rate", "error")).toContain("needed");
  });

  it("counts one field even if its date has two errors", () => {
    const plan = calculateContributionPlan({ ...input(), nextPayDate: "2025-10-01" });
    expect(plan.issues.filter(issue => issue.field === "next-pay-date")).toHaveLength(2);
    expect(sectionErrorCount(plan.issues, ["next-pay-date"])).toBe(1);
  });

  it("clears the field error after the value is corrected", () => {
    const bad = calculateContributionPlan({ ...input(), planMaxPercent: 101 });
    const fixed = calculateContributionPlan({ ...input(), planMaxPercent: 20 });
    expect(fieldMessage(bad.issues, "plan-max-percent", "error")).toBeDefined();
    expect(fieldMessage(fixed.issues, "plan-max-percent", "error")).toBeUndefined();
  });

  it("keeps capped-target guidance at the target amount", () => {
    const plan = calculateContributionPlan({ ...input(), goalType: "target", targetAmount: 50_000 });
    expect(fieldMessage(plan.issues, "target-amount", "warning")).toContain("above");
  });
});

export const TAX_YEAR = 2026;

const REGULAR_DEFERRAL_LIMIT = 24_500;
const STANDARD_CATCH_UP_LIMIT = 8_000;
const HIGH_CATCH_UP_LIMIT = 11_250;

export type PayFrequency =
  | "weekly"
  | "biweekly"
  | "semimonthly"
  | "monthly";

export type ContributionInput = {
  ageAtYearEnd: number;
  annualSalary: number;
  annualSalaryAfterRaise: number;
  raiseEffectiveDate: string | null;
  nextPayDate: string;
  payFrequency: PayFrequency;
  semimonthlySchedule: "1st-and-15th" | "15th-and-last";
  bonusAmount: number;
  bonusPayDate: string | null;
  contributionsYtd: number;
  currentContributionRate: number;
  updateDelayPaychecks: number;
  goalType: "target" | "max";
  targetAmount: number;
};

export type ContributionPlan = {
  errors: string[];
  legalLimit: number;
  goalAmount: number;
  remainingToGoal: number;
  paychecksRemaining: number;
  remainingEligibleCompensation: number;
  recommendedRate: number;
  goalAchievable: boolean;
  projectedAnnualContribution: number;
  contributionsYtd: number;
};

function parseDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function isSemimonthlyPayday(
  date: Date,
  schedule: ContributionInput["semimonthlySchedule"],
): boolean {
  const day = date.getUTCDate();
  const lastDay = lastDayOfMonth(date.getUTCFullYear(), date.getUTCMonth());

  return schedule === "1st-and-15th"
    ? day === 1 || day === 15
    : day === 15 || day === lastDay;
}

function getPayDates(input: ContributionInput, nextPayDate: Date): Date[] {
  const lastDate = new Date(Date.UTC(TAX_YEAR, 11, 31));
  const dates: Date[] = [];

  if (input.payFrequency === "weekly" || input.payFrequency === "biweekly") {
    const interval = input.payFrequency === "weekly" ? 7 : 14;
    const current = new Date(nextPayDate);

    while (current <= lastDate) {
      dates.push(new Date(current));
      current.setUTCDate(current.getUTCDate() + interval);
    }

    return dates;
  }

  if (input.payFrequency === "monthly") {
    const anchorDay = nextPayDate.getUTCDate();
    let year = nextPayDate.getUTCFullYear();
    let month = nextPayDate.getUTCMonth();

    while (true) {
      const current = new Date(
        Date.UTC(year, month, Math.min(anchorDay, lastDayOfMonth(year, month))),
      );

      if (current > lastDate) {
        break;
      }

      if (current >= nextPayDate) {
        dates.push(current);
      }

      month += 1;
      if (month === 12) {
        month = 0;
        year += 1;
      }
    }

    return dates;
  }

  const current = new Date(nextPayDate);
  while (current <= lastDate) {
    if (
      isSemimonthlyPayday(current, input.semimonthlySchedule) &&
      current >= nextPayDate
    ) {
      dates.push(new Date(current));
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function annualLimitForAge(age: number): number {
  if (age >= 60 && age <= 63) {
    return REGULAR_DEFERRAL_LIMIT + HIGH_CATCH_UP_LIMIT;
  }

  if (age >= 50) {
    return REGULAR_DEFERRAL_LIMIT + STANDARD_CATCH_UP_LIMIT;
  }

  return REGULAR_DEFERRAL_LIMIT;
}

function roundToCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function validateInput(input: ContributionInput): {
  errors: string[];
  nextPayDate: Date | null;
  raiseDate: Date | null;
  bonusDate: Date | null;
} {
  const errors: string[] = [];
  const nextPayDate = parseDate(input.nextPayDate);
  const raiseDate = input.raiseEffectiveDate
    ? parseDate(input.raiseEffectiveDate)
    : null;
  const bonusDate = input.bonusPayDate ? parseDate(input.bonusPayDate) : null;

  if (
    !Number.isInteger(input.ageAtYearEnd) ||
    input.ageAtYearEnd < 16 ||
    input.ageAtYearEnd > 120
  ) {
    errors.push("Age must be a whole number from 16 to 120.");
  }
  if (!Number.isFinite(input.annualSalary) || input.annualSalary < 0) {
    errors.push("Current annual salary must be zero or more.");
  }
  if (
    !Number.isFinite(input.annualSalaryAfterRaise) ||
    input.annualSalaryAfterRaise < 0
  ) {
    errors.push("New annual salary must be zero or more.");
  }
  if (!nextPayDate || nextPayDate.getUTCFullYear() !== TAX_YEAR) {
    errors.push("Next paycheck date must be a valid date in 2026.");
  }
  if (input.raiseEffectiveDate && !raiseDate) {
    errors.push("Raise effective date must be a valid date.");
  }
  if (raiseDate && raiseDate.getUTCFullYear() !== TAX_YEAR) {
    errors.push("Raise effective date must be in 2026.");
  }
  if (!Number.isFinite(input.bonusAmount) || input.bonusAmount < 0) {
    errors.push("Expected bonus must be zero or more.");
  }
  if (input.bonusAmount > 0 && !bonusDate) {
    errors.push("Enter the expected bonus pay date.");
  }
  if (input.bonusAmount > 0 && bonusDate) {
    if (bonusDate.getUTCFullYear() !== TAX_YEAR) {
      errors.push("Expected bonus pay date must be in 2026.");
    }
    if (nextPayDate && bonusDate < nextPayDate) {
      errors.push("Expected bonus pay date cannot be before your next paycheck.");
    }
  }
  if (!Number.isFinite(input.contributionsYtd) || input.contributionsYtd < 0) {
    errors.push("Contributions already made must be zero or more.");
  }
  if (
    !Number.isInteger(input.currentContributionRate) ||
    input.currentContributionRate < 0 ||
    input.currentContributionRate > 100
  ) {
    errors.push("Current contribution rate must be a whole number from 0 to 100.");
  }
  if (
    !Number.isInteger(input.updateDelayPaychecks) ||
    input.updateDelayPaychecks < 0 ||
    input.updateDelayPaychecks > 52
  ) {
    errors.push("Update delay must be a whole number from 0 to 52 paychecks.");
  }
  if (
    input.goalType === "target" &&
    (!Number.isFinite(input.targetAmount) || input.targetAmount < 0)
  ) {
    errors.push("Contribution target must be zero or more.");
  }

  if (
    nextPayDate &&
    nextPayDate.getUTCFullYear() === TAX_YEAR &&
    input.payFrequency === "semimonthly" &&
    !isSemimonthlyPayday(nextPayDate, input.semimonthlySchedule)
  ) {
    errors.push(
      "For twice-monthly pay, choose a next paycheck date matching the selected schedule.",
    );
  }

  const legalLimit = annualLimitForAge(input.ageAtYearEnd);
  if (input.goalType === "target" && input.targetAmount > legalLimit) {
    errors.push(
      `Your target cannot exceed the ${legalLimit.toLocaleString("en-US")} IRS employee limit for 2026 and your age.`,
    );
  }

  return { errors, nextPayDate, raiseDate, bonusDate };
}

function projectAnnualContribution(
  input: ContributionInput,
  payDates: Date[],
  raiseDate: Date | null,
  bonusDate: Date | null,
  rate: number,
  currentRate: number,
  updateDelayPaychecks: number,
  legalLimit: number,
): number {
  const periodsPerYear: Record<PayFrequency, number> = {
    weekly: 52,
    biweekly: 26,
    semimonthly: 24,
    monthly: 12,
  };
  const contributionCapRemaining = Math.max(
    0,
    legalLimit - input.contributionsYtd,
  );
  let futureContributions = 0;

  for (const [index, payDate] of payDates.entries()) {
    const salary =
      raiseDate && payDate >= raiseDate
        ? input.annualSalaryAfterRaise
        : input.annualSalary;
    const grossPay = salary / periodsPerYear[input.payFrequency];
    const applicableRate =
      index < updateDelayPaychecks ? currentRate : rate;
    futureContributions += roundToCents((grossPay * applicableRate) / 100);
  }

  if (input.bonusAmount > 0 && bonusDate && bonusDate >= payDates[0]) {
    const firstUpdatedPayDate = payDates[updateDelayPaychecks];
    const bonusRate =
      firstUpdatedPayDate && bonusDate >= firstUpdatedPayDate
        ? rate
        : currentRate;
    futureContributions += roundToCents(
      (input.bonusAmount * bonusRate) / 100,
    );
  }

  return (
    input.contributionsYtd +
    Math.min(contributionCapRemaining, futureContributions)
  );
}

export function calculateContributionPlan(
  input: ContributionInput,
  selectedRate?: number,
): ContributionPlan {
  const validation = validateInput(input);
  const { nextPayDate, raiseDate, bonusDate } = validation;
  const errors = [...validation.errors];
  const legalLimit = annualLimitForAge(input.ageAtYearEnd);
  const goalAmount =
    input.goalType === "max" ? legalLimit : input.targetAmount;
  if (
    selectedRate !== undefined &&
    (!Number.isInteger(selectedRate) || selectedRate < 0 || selectedRate > 100)
  ) {
    errors.push("Contribution percentage must be a whole number from 0 to 100.");
  }

  if (errors.length > 0 || !nextPayDate) {
    return {
      errors,
      legalLimit,
      goalAmount,
      remainingToGoal: Math.max(0, goalAmount - input.contributionsYtd),
      paychecksRemaining: 0,
      remainingEligibleCompensation: 0,
      recommendedRate: 0,
      goalAchievable: false,
      projectedAnnualContribution: input.contributionsYtd,
      contributionsYtd: input.contributionsYtd,
    };
  }

  const payDates = getPayDates(input, nextPayDate);
  const periodsPerYear: Record<PayFrequency, number> = {
    weekly: 52,
    biweekly: 26,
    semimonthly: 24,
    monthly: 12,
  };
  const remainingSalary = payDates.reduce((total, payDate) => {
    const salary =
      raiseDate && payDate >= raiseDate
        ? input.annualSalaryAfterRaise
        : input.annualSalary;
    return total + salary / periodsPerYear[input.payFrequency];
  }, 0);
  const eligibleBonus =
    input.bonusAmount > 0 &&
    bonusDate &&
    bonusDate >= nextPayDate &&
    bonusDate.getUTCFullYear() === TAX_YEAR
      ? input.bonusAmount
      : 0;
  const remainingToGoal = Math.max(0, goalAmount - input.contributionsYtd);
  const projectedAtFullRate = projectAnnualContribution(
    input,
    payDates,
    raiseDate,
    bonusDate,
    100,
    input.currentContributionRate,
    input.updateDelayPaychecks,
    legalLimit,
  );
  const goalAchievable =
    input.contributionsYtd >= goalAmount ||
    projectedAtFullRate >= goalAmount;

  let recommendedRate = 0;
  if (input.contributionsYtd < goalAmount) {
    recommendedRate = 100;
    if (goalAchievable) {
      for (let rate = 1; rate <= 100; rate += 1) {
        if (
          projectAnnualContribution(
            input,
            payDates,
            raiseDate,
            bonusDate,
            rate,
            input.currentContributionRate,
            input.updateDelayPaychecks,
            legalLimit,
          ) >= goalAmount
        ) {
          recommendedRate = rate;
          break;
        }
      }
    }
  }

  const rateToProject = selectedRate ?? recommendedRate;
  const projectedAnnualContribution = projectAnnualContribution(
    input,
    payDates,
    raiseDate,
    bonusDate,
    rateToProject,
    input.currentContributionRate,
    input.updateDelayPaychecks,
    legalLimit,
  );

  return {
    errors: [],
    legalLimit,
    goalAmount,
    remainingToGoal,
    paychecksRemaining: payDates.length,
    remainingEligibleCompensation: remainingSalary + eligibleBonus,
    recommendedRate,
    goalAchievable,
    projectedAnnualContribution,
    contributionsYtd: input.contributionsYtd,
  };
}

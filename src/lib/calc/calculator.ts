import { ANNUAL_LIMITS, getAnnualLimit } from "./limits";
import type {
  Bonus,
  ContributionEvent,
  ContributionPlan,
  EmployerMatch,
  PayFrequency,
  PaycheckComparison,
  PlannerInput,
  Raise,
  ValidationIssue,
} from "./types";

const PERIODS_PER_YEAR: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

type PayDate = {
  date: string;
  index: number;
};

type GrossEvent = {
  id: string;
  date: string;
  type: "paycheck" | "bonus";
  gross: number;
  rate: number;
};

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function contributionAtRate(gross: number, rate: number): number {
  return Math.round(Math.round(gross * 100) * rate / 100) / 100;
}

function endOfMonthDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function isSemimonthlyPayday(
  date: Date,
  schedule: PlannerInput["semimonthlySchedule"],
): boolean {
  const day = date.getUTCDate();
  return schedule === "1st-and-15th"
    ? day === 1 || day === 15
    : day === 15 || day === endOfMonthDay(date.getUTCFullYear(), date.getUTCMonth());
}

function datesThroughYearEnd(input: PlannerInput, firstDate: Date): PayDate[] {
  const endOfYear = `${input.taxYear}-12-31`;
  if (
    input.payFrequency === "weekly" ||
    input.payFrequency === "biweekly"
  ) {
    const interval = input.payFrequency === "weekly" ? 7 : 14;
    const dates: PayDate[] = [];
    const current = new Date(firstDate);
    while (formatDate(current) <= endOfYear) {
      dates.push({ date: formatDate(current), index: dates.length });
      current.setUTCDate(current.getUTCDate() + interval);
    }
    return dates;
  }

  if (input.payFrequency === "monthly") {
    const anchorDay = firstDate.getUTCDate();
    const dates: PayDate[] = [];
    let year = firstDate.getUTCFullYear();
    let month = firstDate.getUTCMonth();
    while (true) {
      const current = new Date(
        Date.UTC(year, month, Math.min(anchorDay, endOfMonthDay(year, month))),
      );
      if (formatDate(current) > endOfYear) {
        return dates;
      }
      dates.push({ date: formatDate(current), index: dates.length });
      month += 1;
      if (month === 12) {
        month = 0;
        year += 1;
      }
    }
  }

  const dates: PayDate[] = [];
  const current = new Date(firstDate);
  while (formatDate(current) <= endOfYear) {
    if (isSemimonthlyPayday(current, input.semimonthlySchedule)) {
      dates.push({ date: formatDate(current), index: dates.length });
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function datesBeforeNextPaycheck(input: PlannerInput, nextPayDate: Date): Date[] {
  const yearStart = new Date(Date.UTC(input.taxYear, 0, 1));
  const nextDateString = formatDate(nextPayDate);
  const dates: Date[] = [];

  if (input.payFrequency === "weekly" || input.payFrequency === "biweekly") {
    const interval = input.payFrequency === "weekly" ? 7 : 14;
    const current = new Date(nextPayDate);
    while (current >= yearStart) {
      current.setUTCDate(current.getUTCDate() - interval);
    }
    current.setUTCDate(current.getUTCDate() + interval);
    while (formatDate(current) < nextDateString) {
      dates.push(new Date(current));
      current.setUTCDate(current.getUTCDate() + interval);
    }
    return dates;
  }

  if (input.payFrequency === "monthly") {
    const anchorDay = nextPayDate.getUTCDate();
    for (let month = 0; month < 12; month += 1) {
      const current = new Date(
        Date.UTC(
          input.taxYear,
          month,
          Math.min(anchorDay, endOfMonthDay(input.taxYear, month)),
        ),
      );
      if (formatDate(current) < nextDateString) dates.push(current);
    }
    return dates;
  }

  const current = new Date(yearStart);
  while (formatDate(current) < nextDateString) {
    if (isSemimonthlyPayday(current, input.semimonthlySchedule)) {
      dates.push(new Date(current));
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function deriveYtdContributionEstimate(input: PlannerInput): number {
  const nextPayDate = parseDate(input.nextPayDate);
  if (
    !nextPayDate ||
    (nextPayDate.getUTCFullYear() !== input.taxYear &&
      nextPayDate.getUTCFullYear() !== input.taxYear + 1)
  ) {
    return 0;
  }
  const paychecksPaid = derivePaychecksPassed(input);
  const contributionPerPaycheck = roundCents(
    (input.annualSalary / PERIODS_PER_YEAR[input.payFrequency]) *
      ((input.currentContributionRate ?? 0) / 100),
  );
  return roundCents(contributionPerPaycheck * paychecksPaid);
}

export function derivePaychecksPassed(input: PlannerInput): number {
  const nextPayDate = parseDate(input.nextPayDate);
  if (
    !nextPayDate ||
    (nextPayDate.getUTCFullYear() !== input.taxYear &&
      nextPayDate.getUTCFullYear() !== input.taxYear + 1)
  ) {
    return 0;
  }
  return datesBeforeNextPaycheck(input, nextPayDate).length;
}

function validatePercent(
  value: number | null,
  label: string,
  report: (field: string | null, message: string) => void,
  field: string,
): void {
  if (
    value !== null &&
    (!Number.isInteger(value) || value < 0 || value > 100)
  ) {
    report(field, `${label} must be a whole number from 0 to 100.`);
  }
}

function validateInput(
  input: PlannerInput,
  selectedRate: number | undefined,
  asOfDate: string,
): { errors: string[]; warnings: string[]; issues: ValidationIssue[]; payDates: PayDate[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const issues: ValidationIssue[] = [];
  const addError = (field: string | null, message: string) => {
    errors.push(message); issues.push({ field, severity: "error", message });
  };
  const addWarning = (field: string | null, message: string) => {
    warnings.push(message); issues.push({ field, severity: "warning", message });
  };
  const limits = ANNUAL_LIMITS[input.taxYear];
  const nextPayDate = parseDate(input.nextPayDate);

  if (!limits) {
    addError(null, `Contribution limits for ${input.taxYear} are not available.`);
  }
  if (
    !Number.isInteger(input.ageAtYearEnd) ||
    input.ageAtYearEnd < 16 ||
    input.ageAtYearEnd > 120
  ) {
    addError("age-at-year-end", "Enter an age from 16 to 120.");
  }
  if (!Number.isFinite(input.annualSalary) || input.annualSalary < 0) {
    addError("annual-salary", "Annual salary must be zero or more.");
  }
  if (
    !nextPayDate ||
    (nextPayDate.getUTCFullYear() !== input.taxYear &&
      nextPayDate.getUTCFullYear() !== input.taxYear + 1)
  ) {
    addError("next-pay-date",
      `Next pay date must be in ${input.taxYear} or the following year if you have no paychecks left.`,
    );
  }
  if (nextPayDate && input.nextPayDate < asOfDate) {
    addError("next-pay-date", "Next pay date has passed. Update it and review your year-to-date contributions before using this plan.");
  }
  if (input.updateDelayPaychecks > 0 && input.currentContributionRate === null) {
    addError("current-rate", "Current contribution rate is needed to estimate paychecks before your new rate starts.");
  }
  if (selectedRate !== undefined && input.planMaxPercent !== null && selectedRate > input.planMaxPercent) {
    addError("rate-check-input", `The rate you are trying exceeds your plan maximum of ${input.planMaxPercent}%.`);
  }
  if (
    input.payFrequency === "semimonthly" &&
    nextPayDate &&
    !isSemimonthlyPayday(nextPayDate, input.semimonthlySchedule)
  ) {
    addError("next-pay-date", "Next pay date does not match your twice-monthly schedule.");
  }
  if (
    !Number.isFinite(input.contributionsYtdThisEmployer) ||
    input.contributionsYtdThisEmployer < 0
  ) {
    addError(input.contributionsYtdOverride === null ? "current-rate" : "ytd-current-employer", "This-employer contributions must be zero or more.");
  }
  if (
    !Number.isFinite(input.contributionsYtdOtherEmployers) ||
    input.contributionsYtdOtherEmployers < 0
  ) {
    addError("ytd-other-employers", "Other-employer contributions must be zero or more.");
  }
  validatePercent(input.currentContributionRate, "Current contribution rate", addError, "current-rate");
  validatePercent(input.planMaxPercent, "Plan maximum percentage", addError, "plan-max-percent");
  if (
    !Number.isInteger(input.updateDelayPaychecks) ||
    input.updateDelayPaychecks < 0 ||
    input.updateDelayPaychecks > 3
  ) {
    addError("update-delay", "Update delay must be 0, 1, 2, or 3 paychecks.");
  }
  if (
    input.goalType === "target" &&
    (!Number.isFinite(input.targetAmount) || input.targetAmount < 0)
  ) {
    addError("target-amount", "Contribution target must be zero or more.");
  }
  if (
    selectedRate !== undefined &&
    (!Number.isInteger(selectedRate) || selectedRate < 0 || selectedRate > 100)
  ) {
    addError("rate-check-input", "Contribution rate must be a whole number from 0 to 100.");
  }

  for (const raise of input.raises) {
    if (raise.annualSalary === null) continue;
    const date = parseDate(raise.effectiveDate);
    if (!date || date.getUTCFullYear() !== input.taxYear) {
      addError(`raise-date-${raise.id}`, "Every raise needs a valid date in the selected tax year.");
    }
    if (
      raise.annualSalary === null ||
      !Number.isFinite(raise.annualSalary) ||
      raise.annualSalary < 0
    ) {
      addError(`raise-salary-${raise.id}`, "A raise salary must be zero or more.");
    }
    if (date && nextPayDate && date < nextPayDate) {
      addWarning(`raise-date-${raise.id}`,
        input.contributionsYtdOverride === null
          ? `The ${raise.effectiveDate} raise is already effective; the salary-based year-to-date estimate excludes past raises. For more precision, you can optionally enter the actual year-to-date amount.`
          : `The ${raise.effectiveDate} raise is already effective; confirm your year-to-date amount includes contributions on the new salary.`,
      );
    }
  }
  for (const bonus of input.bonuses) {
    if (bonus.grossAmount === null) continue;
    const date = parseDate(bonus.payDate);
    if (!date || date.getUTCFullYear() !== input.taxYear) {
      addError(`bonus-date-${bonus.id}`, "Every bonus needs a valid pay date in the selected tax year.");
    }
    if (
      bonus.grossAmount === null ||
      !Number.isFinite(bonus.grossAmount) ||
      bonus.grossAmount < 0
    ) {
      addError(`bonus-amount-${bonus.id}`, "A bonus amount must be zero or more.");
    }
    if (date && bonus.payDate < asOfDate) {
      addWarning(`bonus-date-${bonus.id}`,
        `The ${bonus.payDate} bonus date has passed and will not be projected. Include its contributions in your year-to-date amount.`,
      );
    } else if (date && nextPayDate && date < nextPayDate) {
      addWarning(`bonus-date-${bonus.id}`,
        `The ${bonus.payDate} bonus is before your next regular paycheck, so it will be projected as a separate payment. Include it in your year-to-date amount only if it has already been paid.`,
      );
    }
  }
  if (input.employerMatch) {
    for (const [field, value] of [
      ["employer-match-percent", input.employerMatch.employerMatchPercent],
      ["match-cap-percent", input.employerMatch.employeeContributionCapPercent],
    ] as const) {
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        addError(field, "Employer match percentages must be between 0 and 100.");
      }
    }
  }

  let payDates: PayDate[] = [];
  if (
    nextPayDate &&
    (nextPayDate.getUTCFullYear() === input.taxYear ||
      nextPayDate.getUTCFullYear() === input.taxYear + 1)
  ) {
    const derivedDates = datesThroughYearEnd(input, nextPayDate);
    payDates = derivedDates;
  }

  if (
    payDates.length > 0 &&
    input.updateDelayPaychecks >= payDates.length
  ) {
    addWarning("update-delay",
      "All remaining paychecks will use your current contribution rate; no paycheck will receive the new rate.",
    );
  }

  const ytdTotal =
    input.contributionsYtdThisEmployer +
    input.contributionsYtdOtherEmployers;
  if (limits && ytdTotal > getAnnualLimit(input.ageAtYearEnd, limits)) {
    addError("ytd-summary",
      `Over the limit — contact your plan administrator promptly. Excess deferrals generally need to be returned, with earnings, by April 15, ${input.taxYear + 1}; your plan may have an earlier deadline.`,
    );
  }

  return { errors, warnings, issues, payDates };
}

function salaryOnDate(
  input: PlannerInput,
  date: string,
  raises: Raise[],
): number {
  return raises
    .filter(
      (raise) =>
        raise.effectiveDate <= date && raise.annualSalary !== null,
    )
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
    .reduce((salary, raise) => raise.annualSalary ?? salary, input.annualSalary);
}

function makeGrossEvents(input: PlannerInput, payDates: PayDate[], asOfDate: string): GrossEvent[] {
  const sortedRaises = input.raises
    .filter((raise) => raise.effectiveDate !== "" && raise.annualSalary !== null)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  const firstNewRateDate =
    input.updateDelayPaychecks === 0
      ? asOfDate
      : (payDates[input.updateDelayPaychecks]?.date ?? null);

  const paychecks: GrossEvent[] = payDates.map(({ date, index }) => ({
    id: `paycheck-${index}-${date}`,
    date,
    type: "paycheck",
    gross: roundCents(
      salaryOnDate(input, date, sortedRaises) /
        PERIODS_PER_YEAR[input.payFrequency],
    ),
    rate:
      index < input.updateDelayPaychecks
        ? (input.currentContributionRate ?? 0)
        : -1,
  }));

  const bonuses = input.bonuses
    .filter(
      (bonus) =>
        bonus.payDate !== "" &&
        bonus.grossAmount !== null &&
        bonus.payDate >= asOfDate &&
        bonus.payDate <= `${input.taxYear}-12-31`,
    )
    .map((bonus: Bonus): GrossEvent => ({
      id: bonus.id,
      date: bonus.payDate,
      type: "bonus",
      gross: roundCents(bonus.grossAmount ?? 0),
      rate:
        firstNewRateDate && bonus.payDate >= firstNewRateDate
          ? -1
          : (input.currentContributionRate ?? 0),
    }));

  return [...paychecks, ...bonuses].sort(
    (a, b) => a.date.localeCompare(b.date) ||
      (a.type === b.type ? a.id.localeCompare(b.id) : a.type === "paycheck" ? -1 : 1),
  );
}

function matchForGross(
  gross: number,
  employeeRate: number,
  formula: EmployerMatch | null,
): number {
  if (!formula) {
    return 0;
  }

  const matchedEmployeeRate = Math.min(
    employeeRate,
    formula.employeeContributionCapPercent,
  );
  return roundCents(
    gross *
      (matchedEmployeeRate / 100) *
      (formula.employerMatchPercent / 100),
  );
}

// All contribution arithmetic uses integer cents. Projections are uncapped:
// an employer may not know the participant's contributions at previous jobs.
function simulate(
  input: PlannerInput,
  events: GrossEvent[],
  newRate: number,
  legalLimit: number,
) {
  const ytdCents = Math.round(input.contributionsYtdThisEmployer * 100) +
    Math.round(input.contributionsYtdOtherEmployers * 100);
  const limitCents = Math.round(legalLimit * 100);
  let runningCents = ytdCents;
  let hypotheticalCappedCents = ytdCents;
  let lostMatchCents = 0;
  let limitReachedDate: string | null = null;
  const contributionEvents: ContributionEvent[] = [];

  for (const event of events) {
    const rate = event.rate === -1 ? newRate : event.rate;
    const contributionCents = Math.round(Math.round(event.gross * 100) * rate / 100);
    const cappedCents = Math.min(contributionCents, Math.max(0, limitCents - hypotheticalCappedCents));
    hypotheticalCappedCents += cappedCents;
    runningCents += contributionCents;
    if (limitReachedDate === null && runningCents >= limitCents) limitReachedDate = event.date;
    const employerMatch = event.type === "paycheck"
      ? matchForGross(event.gross, event.gross > 0 ? contributionCents / event.gross : 0, input.employerMatch)
      : 0;
    // Compare the same election with and without a hypothetical payroll cutoff.
    // This includes a partially clipped final paycheck, even on December 31.
    if (event.type === "paycheck" && input.employerMatch && input.planHasTrueUp === false) {
      const cappedMatch = matchForGross(event.gross, event.gross > 0 ? cappedCents / event.gross : 0, input.employerMatch);
      lostMatchCents += Math.max(0, Math.round(employerMatch * 100) - Math.round(cappedMatch * 100));
    }
    contributionEvents.push({
      id: event.id, date: event.date, type: event.type, gross: event.gross,
      rate, contribution: contributionCents / 100, yearToDate: runningCents / 100, employerMatch,
    });
  }
  return { contributionEvents, projectedTotal: runningCents / 100,
    estimatedLostMatch: lostMatchCents / 100, limitReachedDate };
}

function eligibleGrossForNewRate(events: GrossEvent[]): number {
  return roundCents(
    events
      .filter((event) => event.rate === -1)
      .reduce((total, event) => total + event.gross, 0),
  );
}

function currentRateContribution(input: PlannerInput, events: GrossEvent[]): number {
  return events.filter(event => event.rate !== -1).reduce((cents, event) =>
    cents + Math.round(Math.round(event.gross * 100) * (input.currentContributionRate ?? 0) / 100), 0) / 100;
}

export function calculateContributionPlan(
  input: PlannerInput,
  selectedRate?: number,
  asOfDate = todayString(),
): ContributionPlan {
  const validation = validateInput(input, selectedRate, asOfDate);
  const limits = ANNUAL_LIMITS[input.taxYear];
  const legalLimit = limits
    ? getAnnualLimit(input.ageAtYearEnd, limits)
    : 0;
  const goalAmount =
    input.goalType === "max"
      ? legalLimit
      : Math.min(input.targetAmount, legalLimit);
  const ytdTotal =
    input.contributionsYtdThisEmployer +
    input.contributionsYtdOtherEmployers;
  const paychecksAtCurrentRate = Math.min(
    input.updateDelayPaychecks,
    validation.payDates.length,
  );

  if (validation.errors.length > 0 || !limits) {
    return {
      errors: validation.errors,
      warnings: validation.warnings,
      issues: validation.issues,
      legalLimit,
      goalAmount,
      ytdTotal,
      remainingToGoal: Math.max(0, goalAmount - ytdTotal),
      paychecksRemaining: validation.payDates.length,
      paychecksAtCurrentRate,
      contributionsAtCurrentRate: 0,
      eligibleGross: 0,
      recommendedRate: null,
      selectedRate: null,
      projectedTotal: ytdTotal,
      projectedAtCurrentRate: null,
      gap: Math.max(0, goalAmount - ytdTotal),
      nextRate: null,
      nextRateOvershoot: 0,
      contributionEvents: [],
      matchAtRisk: false,
      estimatedLostMatch: 0,
      limitReachedDate: null,
    };
  }

  const grossEvents = makeGrossEvents(input, validation.payDates, asOfDate);
  const eligibleGross = eligibleGrossForNewRate(grossEvents);
  const currentRateFuture = currentRateContribution(
    input,
    grossEvents,
  );
  const planMaximum = input.planMaxPercent ?? 100;
  let recommendedRate: number | null =
    validation.payDates.length === 0 && eligibleGross === 0 ? null : 0;

  if (
    (validation.payDates.length > 0 || eligibleGross > 0) &&
    ytdTotal < goalAmount
  ) {
    if (eligibleGross === 0) {
      recommendedRate = null;
    } else {
      // At most 101 candidates: choose the highest whole rate whose rounded
      // per-event deductions fit. A ratio alone can overshoot by a few cents.
      recommendedRate = 0;
      for (let candidate = 1; candidate <= planMaximum; candidate += 1) {
        if (Math.round(simulate(input, grossEvents, candidate, legalLimit).projectedTotal * 100) > Math.round(goalAmount * 100)) break;
        recommendedRate = candidate;
      }
    }
  }

  const rateToSimulate = selectedRate ?? recommendedRate;
  // Even when no new election can take effect, keep the existing-rate schedule visible.
  const simulation = simulate(input, grossEvents, rateToSimulate ?? 0, legalLimit);
  const projectedAtCurrentRate =
    input.currentContributionRate === null
      ? null
      : simulate(
          input,
          grossEvents,
          input.currentContributionRate,
          legalLimit,
        ).projectedTotal;
  const nextRate =
    recommendedRate !== null &&
    recommendedRate < 100 &&
    recommendedRate < planMaximum
      ? recommendedRate + 1
      : null;
  const nextProjection = nextRate
    ? simulate(input, grossEvents, nextRate, legalLimit).projectedTotal
    : goalAmount;
  const nextRateOvershoot = Math.max(0, roundCents(nextProjection - goalAmount));
  const warnings = [...validation.warnings];
  const issues = [...validation.issues];
  const addWarning = (field: string | null, message: string) => {
    warnings.push(message); issues.push({ field, severity: "warning", message });
  };

  if (
    rateToSimulate !== null &&
    simulation.contributionEvents.some(
      (event) =>
        event.type === "paycheck" &&
        event.gross > 0 &&
        event.contribution / event.gross > 0.7,
    )
  ) {
    addWarning(selectedRate === undefined ? null : "rate-check-input",
      "Payroll may not be able to withhold this much after taxes and benefits.",
    );
  }
  if (simulation.estimatedLostMatch > 0 && input.planHasTrueUp === false) {
    addWarning(null, `Match at risk — if payroll stops at your remaining employee limit, estimated missed match is $${simulation.estimatedLostMatch.toFixed(2)}. This assumes the simple regular-pay match formula you entered and no true-up.`);
  }
  if (input.employerMatch && input.planHasTrueUp === null) {
    addWarning("true-up", "Your plan's true-up rule is unknown. Confirm it in your plan documents before relying on a missed-match estimate.");
  }
  if (ytdTotal + currentRateFuture > goalAmount && ytdTotal <= goalAmount) {
    addWarning("update-delay", "Contributions already scheduled at your current rate would exceed your goal even with a new rate of 0%. Check your payroll change timing.");
  }
  if (
    input.goalType === "target" &&
    input.targetAmount > legalLimit
  ) {
    addWarning("target-amount",
      `Your target is above the ${input.taxYear} IRS employee limit, so the goal is capped at $${legalLimit.toLocaleString("en-US")}.`,
    );
  }
  if (
    input.planMaxPercent !== null &&
    input.planMaxPercent < 100 &&
    recommendedRate === input.planMaxPercent &&
    simulation.projectedTotal < goalAmount
  ) {
    addWarning("plan-max-percent",
      `Your plan maximum of ${input.planMaxPercent}% limits the projected total; the shortfall is $${roundCents(goalAmount - simulation.projectedTotal).toFixed(2)}.`,
    );
  }

  return {
    errors: [],
    warnings,
    issues,
    legalLimit,
    goalAmount,
    ytdTotal,
    remainingToGoal: Math.max(0, goalAmount - ytdTotal),
    paychecksRemaining: validation.payDates.length,
    paychecksAtCurrentRate,
    contributionsAtCurrentRate: roundCents(currentRateFuture),
    eligibleGross,
    recommendedRate,
    selectedRate: rateToSimulate,
    projectedTotal: roundCents(simulation.projectedTotal),
    projectedAtCurrentRate:
      projectedAtCurrentRate === null
        ? null
        : roundCents(projectedAtCurrentRate),
    gap: Math.max(0, roundCents(goalAmount - simulation.projectedTotal)),
    nextRate,
    nextRateOvershoot,
    contributionEvents: simulation.contributionEvents,
    matchAtRisk:
      simulation.estimatedLostMatch > 0 &&
      Boolean(input.employerMatch) &&
      input.planHasTrueUp === false,
    estimatedLostMatch: simulation.estimatedLostMatch,
    limitReachedDate: simulation.limitReachedDate,
  };
}

export function derivePaychecksRemaining(input: PlannerInput): number | null {
  const date = parseDate(input.nextPayDate);
  if (
    !date ||
    (date.getUTCFullYear() !== input.taxYear &&
      date.getUTCFullYear() !== input.taxYear + 1)
  ) {
    return null;
  }
  return datesThroughYearEnd(input, date).length;
}

// Reference rows add context only; they are never added to projected totals or YTD.
export function comparePaychecks(input: PlannerInput, plan: ContributionPlan): PaycheckComparison {
  const empty: PaycheckComparison = {
    reference: null, firstNewPaycheck: null, currentRate: input.currentContributionRate,
    currentRateContribution: null, changePerPaycheck: null,
  };
  if (plan.errors.length > 0 || plan.recommendedRate === null) return empty;
  const regular = plan.contributionEvents.filter(event => event.type === "paycheck");
  const firstNewPaycheck = regular[plan.paychecksAtCurrentRate] ?? null;
  if (!firstNewPaycheck) return empty;
  const currentRateContribution = input.currentContributionRate === null ? null
    : contributionAtRate(firstNewPaycheck.gross, input.currentContributionRate);
  const comparison: PaycheckComparison = {
    ...empty, firstNewPaycheck, currentRateContribution,
    changePerPaycheck: currentRateContribution === null ? null
      : roundCents(firstNewPaycheck.contribution - currentRateContribution),
  };
  if (input.currentContributionRate === null) return comparison;
  const previousScheduled = regular[plan.paychecksAtCurrentRate - 1];
  if (previousScheduled) {
    return { ...comparison, reference: { ...previousScheduled, isHistoricalEstimate: false } };
  }
  const next = parseDate(input.nextPayDate);
  const previousDate = next ? datesBeforeNextPaycheck(input, next).at(-1) : null;
  if (!previousDate || previousDate.getUTCFullYear() !== input.taxYear) return comparison;
  const date = formatDate(previousDate);
  const gross = roundCents(salaryOnDate(input, date, input.raises) / PERIODS_PER_YEAR[input.payFrequency]);
  return { ...comparison, reference: {
    id: `reference-${date}`, date, gross, rate: input.currentContributionRate,
    contribution: contributionAtRate(gross, input.currentContributionRate),
    isHistoricalEstimate: true,
  } };
}

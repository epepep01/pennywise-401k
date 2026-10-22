import { ANNUAL_LIMITS, getAnnualLimit } from "./limits";
import type {
  Bonus,
  ContributionEvent,
  ContributionPlan,
  EmployerMatch,
  PayFrequency,
  PlannerInput,
  Raise,
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

function todayString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
  errors: string[],
): void {
  if (
    value !== null &&
    (!Number.isInteger(value) || value < 0 || value > 100)
  ) {
    errors.push(`${label} must be a whole number from 0 to 100.`);
  }
}

function validateInput(
  input: PlannerInput,
  selectedRate: number | undefined,
): { errors: string[]; warnings: string[]; payDates: PayDate[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const limits = ANNUAL_LIMITS[input.taxYear];
  const nextPayDate = parseDate(input.nextPayDate);

  if (!limits) {
    errors.push(`Contribution limits for ${input.taxYear} are not available.`);
  }
  if (
    !Number.isInteger(input.ageAtYearEnd) ||
    input.ageAtYearEnd < 16 ||
    input.ageAtYearEnd > 120
  ) {
    errors.push("Enter an age from 16 to 120.");
  }
  if (!Number.isFinite(input.annualSalary) || input.annualSalary < 0) {
    errors.push("Annual salary must be zero or more.");
  }
  if (
    !nextPayDate ||
    (nextPayDate.getUTCFullYear() !== input.taxYear &&
      nextPayDate.getUTCFullYear() !== input.taxYear + 1)
  ) {
    errors.push(
      `Next pay date must be in ${input.taxYear} or the following year if you have no paychecks left.`,
    );
  }
  if (
    input.payFrequency === "semimonthly" &&
    nextPayDate &&
    !isSemimonthlyPayday(nextPayDate, input.semimonthlySchedule)
  ) {
    errors.push("Next pay date does not match your twice-monthly schedule.");
  }
  if (
    !Number.isFinite(input.contributionsYtdThisEmployer) ||
    input.contributionsYtdThisEmployer < 0
  ) {
    errors.push("This-employer contributions must be zero or more.");
  }
  if (
    !Number.isFinite(input.contributionsYtdOtherEmployers) ||
    input.contributionsYtdOtherEmployers < 0
  ) {
    errors.push("Other-employer contributions must be zero or more.");
  }
  validatePercent(input.currentContributionRate, "Current contribution rate", errors);
  validatePercent(input.planMaxPercent, "Plan maximum percentage", errors);
  if (
    !Number.isInteger(input.updateDelayPaychecks) ||
    input.updateDelayPaychecks < 0 ||
    input.updateDelayPaychecks > 3
  ) {
    errors.push("Update delay must be 0, 1, 2, or 3 paychecks.");
  }
  if (
    input.goalType === "target" &&
    (!Number.isFinite(input.targetAmount) || input.targetAmount < 0)
  ) {
    errors.push("Contribution target must be zero or more.");
  }
  if (
    selectedRate !== undefined &&
    (!Number.isInteger(selectedRate) || selectedRate < 0 || selectedRate > 100)
  ) {
    errors.push("Contribution rate must be a whole number from 0 to 100.");
  }

  for (const raise of input.raises) {
    if (raise.annualSalary === null) continue;
    const date = parseDate(raise.effectiveDate);
    if (!date || date.getUTCFullYear() !== input.taxYear) {
      errors.push("Every raise needs a valid date in the selected tax year.");
    }
    if (
      raise.annualSalary === null ||
      !Number.isFinite(raise.annualSalary) ||
      raise.annualSalary < 0
    ) {
      errors.push("A raise salary must be zero or more.");
    }
    if (date && nextPayDate && date < nextPayDate) {
      warnings.push(
        input.contributionsYtdOverride === null
          ? `The ${raise.effectiveDate} raise is already effective; the salary-based year-to-date estimate excludes past raises. Enter the actual year-to-date amount from your paystub.`
          : `The ${raise.effectiveDate} raise is already effective; confirm your year-to-date amount includes contributions on the new salary.`,
      );
    }
  }
  for (const bonus of input.bonuses) {
    if (bonus.grossAmount === null) continue;
    const date = parseDate(bonus.payDate);
    if (!date || date.getUTCFullYear() !== input.taxYear) {
      errors.push("Every bonus needs a valid pay date in the selected tax year.");
    }
    if (
      bonus.grossAmount === null ||
      !Number.isFinite(bonus.grossAmount) ||
      bonus.grossAmount < 0
    ) {
      errors.push("A bonus amount must be zero or more.");
    }
    if (date && bonus.payDate < todayString()) {
      warnings.push(
        `The ${bonus.payDate} bonus date has passed and will not be projected. Include its contributions in your year-to-date amount.`,
      );
    } else if (date && nextPayDate && date < nextPayDate) {
      warnings.push(
        `The ${bonus.payDate} bonus is before your next regular paycheck, so it will be projected as a separate payment. Include it in your year-to-date amount only if it has already been paid.`,
      );
    }
  }
  if (
    input.employerMatch &&
    (!Number.isFinite(input.employerMatch.employerMatchPercent) ||
      input.employerMatch.employerMatchPercent < 0 ||
      input.employerMatch.employerMatchPercent > 100 ||
      !Number.isFinite(
        input.employerMatch.employeeContributionCapPercent,
      ) ||
      input.employerMatch.employeeContributionCapPercent < 0 ||
      input.employerMatch.employeeContributionCapPercent > 100)
  ) {
    errors.push("Employer match percentages must be between 0 and 100.");
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
    warnings.push(
      "All remaining paychecks will use your current contribution rate; no paycheck will receive the new rate.",
    );
  }

  const ytdTotal =
    input.contributionsYtdThisEmployer +
    input.contributionsYtdOtherEmployers;
  if (limits && ytdTotal > getAnnualLimit(input.ageAtYearEnd, limits)) {
    errors.push(
      "Over the limit — excess deferrals generally must be reported and corrected by April 15.",
    );
  }

  return { errors, warnings, payDates };
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

function makeGrossEvents(input: PlannerInput, payDates: PayDate[]): GrossEvent[] {
  const sortedRaises = input.raises
    .filter((raise) => raise.effectiveDate !== "" && raise.annualSalary !== null)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  const firstNewRateDate =
    input.updateDelayPaychecks === 0
      ? todayString()
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
        bonus.payDate >= todayString() &&
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
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.type === "paycheck" ? -1 : 1) ||
      a.id.localeCompare(b.id),
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

function simulate(
  input: PlannerInput,
  events: GrossEvent[],
  newRate: number,
  legalLimit: number,
  applyLegalLimit = true,
): {
  contributionEvents: ContributionEvent[];
  projectedTotal: number;
  estimatedLostMatch: number;
  limitReachedDate: string | null;
} {
  const ytdTotal =
    input.contributionsYtdThisEmployer +
    input.contributionsYtdOtherEmployers;
  let runningTotal = ytdTotal;
  let projectedTotal = ytdTotal;
  let limitReachedDate: string | null = null;
  let estimatedLostMatch = 0;
  const contributionEvents: ContributionEvent[] = [];

  for (const event of events) {
    const appliedRate = event.rate === -1 ? newRate : event.rate;
    const available = applyLegalLimit
      ? Math.max(0, legalLimit - runningTotal)
      : Number.POSITIVE_INFINITY;
    const contribution = Math.min(
      available,
      roundCents((event.gross * appliedRate) / 100),
    );
    runningTotal = roundCents(runningTotal + contribution);
    projectedTotal = runningTotal;

    if (limitReachedDate === null && runningTotal >= legalLimit) {
      limitReachedDate = event.date;
    }

    const employerMatch =
      event.type === "paycheck"
        ? matchForGross(
            event.gross,
            event.gross > 0 ? (contribution / event.gross) * 100 : 0,
            input.employerMatch,
          )
        : 0;
    contributionEvents.push({
      id: event.id,
      date: event.date,
      type: event.type,
      gross: event.gross,
      rate: appliedRate,
      contribution,
      yearToDate: runningTotal,
      employerMatch,
    });
  }

  if (
    input.employerMatch &&
    !input.planHasTrueUp &&
    limitReachedDate &&
    limitReachedDate < `${input.taxYear}-12-31`
  ) {
    estimatedLostMatch = events
      .filter(
        (event) =>
          event.type === "paycheck" && event.date > limitReachedDate!,
      )
      .reduce(
        (lost, event) =>
          lost +
          matchForGross(
            event.gross,
            input.employerMatch!.employeeContributionCapPercent,
            input.employerMatch,
          ),
        0,
      );
    estimatedLostMatch = roundCents(estimatedLostMatch);
  }

  return {
    contributionEvents,
    projectedTotal,
    estimatedLostMatch,
    limitReachedDate,
  };
}

function eligibleGrossForNewRate(events: GrossEvent[]): number {
  return roundCents(
    events
      .filter((event) => event.rate === -1)
      .reduce((total, event) => total + event.gross, 0),
  );
}

function currentRateContribution(
  input: PlannerInput,
  events: GrossEvent[],
  legalLimit: number,
): number {
  const ytdTotal =
    input.contributionsYtdThisEmployer +
    input.contributionsYtdOtherEmployers;
  let total = ytdTotal;

  for (const event of events.filter((item) => item.rate !== -1)) {
    total = Math.min(
      legalLimit,
      roundCents(
        total +
          roundCents((event.gross * (input.currentContributionRate ?? 0)) / 100),
      ),
    );
  }

  return total - ytdTotal;
}

export function calculateContributionPlan(
  input: PlannerInput,
  selectedRate?: number,
): ContributionPlan {
  const validation = validateInput(input, selectedRate);
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

  const grossEvents = makeGrossEvents(input, validation.payDates);
  const eligibleGross = eligibleGrossForNewRate(grossEvents);
  const currentRateFuture = currentRateContribution(
    input,
    grossEvents,
    legalLimit,
  );
  const remainingAfterCurrentChecks = Math.max(
    0,
    goalAmount - ytdTotal - currentRateFuture,
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
      recommendedRate = Math.min(
        planMaximum,
        Math.floor((remainingAfterCurrentChecks / eligibleGross) * 100),
      );
      recommendedRate = Math.max(0, recommendedRate);
    }
  }

  const rateToSimulate = selectedRate ?? recommendedRate;
  const simulation =
    rateToSimulate === null
      ? {
          contributionEvents: [] as ContributionEvent[],
          projectedTotal: ytdTotal + currentRateFuture,
          estimatedLostMatch: 0,
          limitReachedDate: null,
        }
      : simulate(input, grossEvents, rateToSimulate, legalLimit);
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
    ? simulate(input, grossEvents, nextRate, legalLimit, false).projectedTotal
    : goalAmount;
  const nextRateOvershoot = Math.max(0, roundCents(nextProjection - goalAmount));
  const warnings = [...validation.warnings];

  if (
    rateToSimulate !== null &&
    simulation.contributionEvents.some(
      (event) =>
        event.type === "paycheck" &&
        event.gross > 0 &&
        event.contribution / event.gross > 0.7,
    )
  ) {
    warnings.push(
      "Payroll may not be able to withhold this much after taxes and benefits.",
    );
  }
  if (
    simulation.limitReachedDate &&
    simulation.limitReachedDate < `${input.taxYear}-12-31` &&
    input.employerMatch &&
    !input.planHasTrueUp
  ) {
    warnings.push(
      `Match at risk — your contributions may reach the limit on ${simulation.limitReachedDate}. Estimated lost match: $${simulation.estimatedLostMatch.toFixed(2)}.`,
    );
  }
  if (
    input.goalType === "target" &&
    input.targetAmount > legalLimit
  ) {
    warnings.push(
      `Your target is above the ${input.taxYear} IRS employee limit, so the goal is capped at $${legalLimit.toLocaleString("en-US")}.`,
    );
  }
  if (
    input.planMaxPercent !== null &&
    input.planMaxPercent < 100 &&
    recommendedRate === input.planMaxPercent &&
    simulation.projectedTotal < goalAmount
  ) {
    warnings.push(
      `Your plan maximum of ${input.planMaxPercent}% limits the projected total; the shortfall is $${roundCents(goalAmount - simulation.projectedTotal).toFixed(2)}.`,
    );
  }

  return {
    errors: [],
    warnings,
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
      !input.planHasTrueUp,
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

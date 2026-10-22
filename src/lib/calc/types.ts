export type PayFrequency =
  | "weekly"
  | "biweekly"
  | "semimonthly"
  | "monthly";

export type GoalType = "max" | "target";

export type Raise = {
  id: string;
  effectiveDate: string;
  annualSalary: number | null;
};

export type Bonus = {
  id: string;
  payDate: string;
  grossAmount: number | null;
};

export type EmployerMatch = {
  employerMatchPercent: number;
  employeeContributionCapPercent: number;
};

export type PlannerInput = {
  taxYear: number;
  ageAtYearEnd: number;
  annualSalary: number;
  payFrequency: PayFrequency;
  nextPayDate: string;
  semimonthlySchedule: "1st-and-15th" | "15th-and-last";
  contributionsYtdThisEmployer: number;
  contributionsYtdOverride: number | null;
  contributionsYtdOtherEmployers: number;
  currentContributionRate: number | null;
  updateDelayPaychecks: number;
  goalType: GoalType;
  targetAmount: number;
  planMaxPercent: number | null;
  raises: Raise[];
  bonuses: Bonus[];
  employerMatch: EmployerMatch | null;
  planHasTrueUp: boolean | null;
};

export type ContributionEvent = {
  id: string;
  date: string;
  type: "paycheck" | "bonus";
  gross: number;
  rate: number;
  contribution: number;
  yearToDate: number;
  employerMatch: number;
};

export type PaycheckReference = {
  id: string;
  date: string;
  gross: number;
  rate: number;
  contribution: number;
  isHistoricalEstimate: boolean;
};

export type PaycheckComparison = {
  reference: PaycheckReference | null;
  firstNewPaycheck: ContributionEvent | null;
  currentRate: number | null;
  currentRateContribution: number | null;
  changePerPaycheck: number | null;
};

export type ValidationIssue = {
  field: string | null;
  severity: "error" | "warning";
  message: string;
};

export type ContributionPlan = {
  errors: string[];
  warnings: string[];
  issues: ValidationIssue[];
  legalLimit: number;
  goalAmount: number;
  ytdTotal: number;
  remainingToGoal: number;
  paychecksRemaining: number;
  paychecksAtCurrentRate: number;
  contributionsAtCurrentRate: number;
  eligibleGross: number;
  recommendedRate: number | null;
  selectedRate: number | null;
  projectedTotal: number;
  projectedAtCurrentRate: number | null;
  gap: number;
  nextRate: number | null;
  nextRateOvershoot: number;
  contributionEvents: ContributionEvent[];
  matchAtRisk: boolean;
  estimatedLostMatch: number;
  limitReachedDate: string | null;
};

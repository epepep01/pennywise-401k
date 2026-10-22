import { todayString } from "./calculator";
import type {
  Bonus,
  EmployerMatch,
  PayFrequency,
  PlannerInput,
  Raise,
} from "./types";

export type PlannerProfile = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  plan: PlannerInput;
};

const PROFILE_STORAGE_KEY = "ledger-planner-profiles-v1";
const EMPTY_PROFILES: PlannerProfile[] = [];
const PAY_FREQUENCIES: PayFrequency[] = [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
];

export function createInitialPlan(): PlannerInput {
  const today = new Date(`${todayString()}T12:00:00Z`);
  today.setUTCDate(today.getUTCDate() + ((5 - today.getUTCDay() + 7) % 7));
  const nextPayDate = today.toISOString().slice(0, 10);
  return {
    taxYear: 2026,
    ageAtYearEnd: 35,
    annualSalary: 104_000,
    payFrequency: "biweekly",
    nextPayDate,
    semimonthlySchedule: "1st-and-15th",
    contributionsYtdThisEmployer: 0,
    contributionsYtdOverride: null,
    contributionsYtdOtherEmployers: 0,
    currentContributionRate: 6,
    updateDelayPaychecks: 0,
    goalType: "max",
    targetAmount: 24_500,
    planMaxPercent: null,
    raises: [{ id: "raise-1", effectiveDate: "", annualSalary: null }],
    bonuses: [{ id: "bonus-1", payDate: nextPayDate, grossAmount: null }],
    employerMatch: null,
    planHasTrueUp: null,
  };
}

export function createProfile(name: string): PlannerProfile {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
    plan: createInitialPlan(),
  };
}

function isRaise(value: unknown): value is Raise {
  if (!value || typeof value !== "object") return false;
  const raise = value as Record<string, unknown>;
  return (
    typeof raise.id === "string" &&
    typeof raise.effectiveDate === "string" &&
    (raise.annualSalary === null || typeof raise.annualSalary === "number")
  );
}

function isBonus(value: unknown): value is Bonus {
  if (!value || typeof value !== "object") return false;
  const bonus = value as Record<string, unknown>;
  return (
    typeof bonus.id === "string" &&
    typeof bonus.payDate === "string" &&
    (bonus.grossAmount === null || typeof bonus.grossAmount === "number")
  );
}

function isEmployerMatch(value: unknown): value is EmployerMatch | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const match = value as Record<string, unknown>;
  return (
    typeof match.employerMatchPercent === "number" &&
    typeof match.employeeContributionCapPercent === "number"
  );
}

function isPlannerInput(value: unknown): value is PlannerInput {
  if (!value || typeof value !== "object") return false;
  const plan = value as Record<string, unknown>;
  return (
    typeof plan.taxYear === "number" &&
    typeof plan.ageAtYearEnd === "number" &&
    typeof plan.annualSalary === "number" &&
    PAY_FREQUENCIES.includes(plan.payFrequency as PayFrequency) &&
    typeof plan.nextPayDate === "string" &&
    (plan.semimonthlySchedule === "1st-and-15th" ||
      plan.semimonthlySchedule === "15th-and-last") &&
    typeof plan.contributionsYtdThisEmployer === "number" &&
    (plan.contributionsYtdOverride === null ||
      typeof plan.contributionsYtdOverride === "number") &&
    typeof plan.contributionsYtdOtherEmployers === "number" &&
    (plan.currentContributionRate === null ||
      typeof plan.currentContributionRate === "number") &&
    typeof plan.updateDelayPaychecks === "number" &&
    (plan.goalType === "max" || plan.goalType === "target") &&
    typeof plan.targetAmount === "number" &&
    (plan.planMaxPercent === null ||
      typeof plan.planMaxPercent === "number") &&
    Array.isArray(plan.raises) &&
    plan.raises.every(isRaise) &&
    Array.isArray(plan.bonuses) &&
    plan.bonuses.every(isBonus) &&
    isEmployerMatch(plan.employerMatch) &&
    (plan.planHasTrueUp === null || typeof plan.planHasTrueUp === "boolean")
  );
}

export function parseProfiles(serialized: string): PlannerProfile[] {
  const value: unknown = JSON.parse(serialized);
  if (!Array.isArray(value)) {
    throw new Error("Saved profiles are not in the expected format.");
  }

  const migratedValue = value.map((profile) => {
    if (!profile || typeof profile !== "object") return profile;
    const candidate = profile as Record<string, unknown>;
    if (!candidate.plan || typeof candidate.plan !== "object") return profile;
    const plan = candidate.plan as Record<string, unknown>;
    const migratedPlan = { ...plan };
    if (typeof migratedPlan.contributionsYtdOverride !== "number" &&
      migratedPlan.contributionsYtdOverride !== null) {
      migratedPlan.contributionsYtdOverride =
        typeof plan.contributionsYtdThisEmployer === "number"
          ? plan.contributionsYtdThisEmployer
          : null;
    }
    delete migratedPlan.paychecksRemainingOverride;
    return {
      ...candidate,
      plan: migratedPlan,
    };
  });

  if (
    !migratedValue.every(
      (profile): profile is PlannerProfile =>
        Boolean(profile) &&
        typeof profile === "object" &&
        typeof profile.id === "string" &&
        typeof profile.name === "string" &&
        typeof profile.createdAt === "string" &&
        typeof profile.updatedAt === "string" &&
        isPlannerInput(profile.plan),
    )
  ) {
    throw new Error(
      "A saved profile is incomplete. Clear the damaged browser data or add a new plan.",
    );
  }

  return migratedValue;
}

export function saveProfiles(profiles: PlannerProfile[]): void {
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

export function loadProfiles(): PlannerProfile[] {
  const serialized = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  return serialized === null ? [] : parseProfiles(serialized);
}

let profileSnapshot = EMPTY_PROFILES;
let storageErrorSnapshot = "";
let initialized = false;
const profileListeners = new Set<() => void>();
const errorListeners = new Set<() => void>();

function notify(listeners: Set<() => void>) {
  for (const listener of listeners) listener();
}

function initializeProfiles() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    profileSnapshot = loadProfiles();
  } catch (error) {
    storageErrorSnapshot =
      error instanceof Error
        ? error.message
        : "Your saved plans could not be read from this browser.";
  }
}

function refreshFromStorage() {
  try {
    profileSnapshot = loadProfiles();
    storageErrorSnapshot = "";
  } catch (error) {
    storageErrorSnapshot =
      error instanceof Error
        ? error.message
        : "Your saved plans could not be read from this browser.";
  }
  notify(profileListeners);
  notify(errorListeners);
}

function onStorageChange(event: StorageEvent) {
  if (event.key === PROFILE_STORAGE_KEY || event.key === null) {
    refreshFromStorage();
  }
}

export function getProfilesSnapshot(): PlannerProfile[] {
  initializeProfiles();
  return profileSnapshot;
}

export function getEmptyProfilesSnapshot(): PlannerProfile[] {
  return EMPTY_PROFILES;
}

export function getStorageErrorSnapshot(): string {
  initializeProfiles();
  return storageErrorSnapshot;
}

export function subscribeToProfiles(listener: () => void): () => void {
  profileListeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorageChange);
  }
  return () => {
    profileListeners.delete(listener);
    if (typeof window !== "undefined" && profileListeners.size === 0) {
      window.removeEventListener("storage", onStorageChange);
    }
  };
}

export function subscribeToStorageError(listener: () => void): () => void {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

export function replaceProfiles(
  update: (current: PlannerProfile[]) => PlannerProfile[],
): string {
  initializeProfiles();
  profileSnapshot = update(profileSnapshot);
  try {
    saveProfiles(profileSnapshot);
    storageErrorSnapshot = "";
  } catch (error) {
    storageErrorSnapshot =
      error instanceof Error
        ? `Your changes could not be saved in this browser: ${error.message}`
        : "Your changes could not be saved in this browser.";
  }
  notify(profileListeners);
  notify(errorListeners);
  return storageErrorSnapshot;
}

export function clearSavedProfiles(): string {
  initializeProfiles();
  try {
    window.localStorage.removeItem(PROFILE_STORAGE_KEY);
    profileSnapshot = EMPTY_PROFILES;
    storageErrorSnapshot = "";
  } catch (error) {
    storageErrorSnapshot =
      error instanceof Error
        ? `The saved data could not be cleared: ${error.message}`
        : "The saved data could not be cleared.";
  }
  notify(profileListeners);
  notify(errorListeners);
  return storageErrorSnapshot;
}

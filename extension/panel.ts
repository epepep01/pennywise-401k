import { chromeApi } from "./chrome";
import { type Candidate } from "./import";
import { revokeReadAccess } from "./access";
import { readProvider, reviewIsFresh, REVIEW_LIFETIME_MS, type ReviewedSource } from "./read-provider";
import { calculateContributionPlan, comparePaychecks } from "../src/lib/calc/calculator";
import type { PayFrequency, PlannerInput } from "../src/lib/calc/types";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing panel element: ${id}`);
  return found as T;
}
const form = element<HTMLFormElement>("planner");
const review = element<HTMLFormElement>("import-review");
const status = element("import-status");
const result = element("result");
const readButton = element<HTMLButtonElement>("read");
let candidates: Candidate[] = [];
let source: ReviewedSource | undefined;
let readGeneration = 0;
let reviewTimer: ReturnType<typeof setTimeout> | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

function field(name: string): HTMLInputElement | HTMLSelectElement {
  return form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
}
function paragraph(parent: HTMLElement, text: string, className = "") {
  const node = document.createElement("p");
  node.textContent = text;
  node.className = className;
  parent.append(node);
}
function resetReview() {
  clearTimeout(reviewTimer);
  source = undefined;
  candidates = [];
  review.reset();
  review.hidden = true;
  element("candidates").replaceChildren();
}
function invalidateResult() {
  result.hidden = true;
  result.replaceChildren();
}
function clearData(message = "Calculator and imported details cleared.") {
  readGeneration++;
  form.reset();
  resetReview();
  invalidateResult();
  element("semimonthly").hidden = true;
  element("target").hidden = true;
  (field("targetAmount") as HTMLInputElement).required = false;
  status.textContent = message;
  void revokeReadAccess().catch(() => {
    status.textContent = "Page access cleanup failed. Disable Pennywise in Chrome before continuing.";
  });
}
element("clear").addEventListener("click", () => clearData());
function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => clearData("Data cleared after five minutes of inactivity."), 5 * 60_000);
}
for (const event of ["input", "click", "keydown"] as const) document.addEventListener(event, resetIdleTimer);
resetIdleTimer();
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearData("Data cleared when the panel was hidden.");
});
window.addEventListener("pagehide", () => clearData());
function discardPendingRead() {
  readGeneration++;
  if (source) {
    resetReview();
    status.textContent = "Page changed. Pending import cleared; read the contribution page again.";
  }
}
// No URL or browsing history is retained by these invalidation-only listeners.
chromeApi?.tabs?.onActivated.addListener(discardPendingRead);
chromeApi?.tabs?.onUpdated.addListener(discardPendingRead);
form.addEventListener("input", () => {
  invalidateResult();
  element("semimonthly").hidden = field("payFrequency").value !== "semimonthly";
  element("target").hidden = field("goalType").value !== "target";
  (field("targetAmount") as HTMLInputElement).required = field("goalType").value === "target";
});

readButton.addEventListener("click", async () => {
  resetReview();
  const generation = ++readGeneration;
  readButton.disabled = true;
  status.textContent = "Reading visible contribution labels…";
  try {
    const snapshot = await readProvider(() => generation === readGeneration && !document.hidden);
    if (generation !== readGeneration || document.hidden) return;
    source = snapshot;
    candidates = snapshot.candidates;
    status.textContent = candidates.length
      ? `Fidelity contribution overview · ${new Date(snapshot.capturedAt).toLocaleTimeString()}. Page access removed. Verify the employer, 2026 tax year, and employee-only totals. Import expires in one minute.`
      : "Page access removed. No unambiguous employee totals found. Enter details manually; split pretax/Roth rates and embedded content need manual entry.";
    if (!candidates.length) return;
    const container = element("candidates");
    for (const [index, candidate] of candidates.entries()) {
      const label = document.createElement("label");
      label.className = "candidate";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = candidate.field;
      radio.value = String(index);
      label.append(radio, document.createTextNode(candidate.evidence));
      container.append(label);
    }
    review.hidden = false;
    reviewTimer = setTimeout(() => {
      resetReview();
      status.textContent = "Pending import expired. Read again or enter details manually.";
    }, REVIEW_LIFETIME_MS);
  } catch (error) {
    if (generation !== readGeneration) return;
    status.textContent = error instanceof Error && /^(Open Fidelity|Page access was declined|Provider access could not|Page changed|The active page changed|Read cancelled)/.test(error.message)
      ? error.message
      : "Could not read the contribution overview. Authentication screens and unsupported pages are refused. Use manual entry. If Chrome still shows site access, disable Pennywise before continuing.";
  } finally {
    readButton.disabled = false;
  }
});

review.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!source || !reviewIsFresh(source)) {
    resetReview();
    status.textContent = "Pending import expired. Read again or enter details manually.";
    return;
  }
  if (!review.reportValidity()) return;
  const selected = [...new FormData(review).values()].map(Number);
  if (!selected.length) {
    status.textContent = "Select the details you have verified, or dismiss to enter them manually.";
    return;
  }
  for (const index of selected) {
    const candidate = candidates[index];
    if (candidate) field(candidate.field).value = String(candidate.value);
  }
  invalidateResult();
  resetReview();
  status.textContent = "Selected details copied. Review your inputs, then calculate. Read the page again after switching accounts or tax years.";
});
element("dismiss").addEventListener("click", () => {
  resetReview();
  status.textContent = "Import dismissed. Enter your details below.";
});

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
form.addEventListener("submit", (event) => {
  event.preventDefault();
  invalidateResult();
  if (!form.reportValidity()) return;
  const number = (name: string) => Number(field(name).value);
  const input: PlannerInput = {
    taxYear: 2026,
    annualSalary: number("annualSalary"),
    ageAtYearEnd: number("ageAtYearEnd"),
    currentContributionRate: number("currentContributionRate"),
    contributionsYtdThisEmployer: number("contributionsYtdThisEmployer"),
    contributionsYtdOverride: number("contributionsYtdThisEmployer"),
    contributionsYtdOtherEmployers: number("contributionsYtdOtherEmployers"),
    nextPayDate: field("nextPayDate").value,
    payFrequency: field("payFrequency").value as PayFrequency,
    semimonthlySchedule: field("semimonthlySchedule").value as PlannerInput["semimonthlySchedule"],
    updateDelayPaychecks: number("updateDelayPaychecks"),
    goalType: field("goalType").value as PlannerInput["goalType"],
    targetAmount: number("targetAmount"),
    planMaxPercent: field("planMaxPercent").value === "" ? null : number("planMaxPercent"),
    raises: [], bonuses: [], employerMatch: null, planHasTrueUp: null,
  };
  const plan = calculateContributionPlan(input);
  result.hidden = false;
  const heading = document.createElement("h2");
  heading.textContent = plan.errors.length ? "Check your plan" : "Your contribution plan";
  result.append(heading);
  for (const error of plan.errors) paragraph(result, error, "error");
  if (plan.errors.length) return;
  if (plan.recommendedRate !== null) {
    paragraph(result, `${plan.recommendedRate}%`, "rate");
    paragraph(result, "Recommended total employee rate · pretax + Roth");
    paragraph(result, `Projected employee contributions: ${dollars.format(plan.projectedTotal)}`);
    paragraph(result, `Goal: ${dollars.format(plan.goalAmount)} · Gap: ${dollars.format(plan.gap)}`);
    paragraph(result, `${plan.paychecksRemaining} paychecks remaining · ${plan.paychecksAtCurrentRate} before the change`);
    const comparison = comparePaychecks(input, plan);
    if (comparison.firstNewPaycheck && comparison.currentRateContribution !== null) {
      paragraph(result, `First paycheck at the new rate: ${dollars.format(comparison.firstNewPaycheck.contribution)} contributed, compared with ${dollars.format(comparison.currentRateContribution)} at your current rate.`);
    }
  }
  for (const warning of plan.warnings) paragraph(result, warning, "warning");
  paragraph(result, "Check how your provider splits pretax and Roth elections. Make any changes yourself on your provider’s site; this extension does not fill or submit forms.");
});

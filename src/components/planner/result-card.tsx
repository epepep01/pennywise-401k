import type { ContributionPlan, PaycheckComparison, PlannerInput } from "@/lib/calc/types";
import { PaycheckChange } from "./paycheck-change";
import { formatDollars as dollars } from "../../lib/calc/money";

type ResultCardProps = {
  plan: ContributionPlan;
  comparison: ContributionPlan | null;
  paycheckComparison: PaycheckComparison | null;
  input: PlannerInput;
  selectedRate: string;
  onSelectedRateChange: (value: string) => void;
  onUseRecommendation: () => void;
  className: string;
};

function MatchNotice({ plan }: { plan: ContributionPlan }) {
  if (!plan.matchAtRisk || !plan.limitReachedDate) return null;
  return <p className="notice notice--info">
    If payroll stops at your remaining employee limit on{" "}
    {new Date(`${plan.limitReachedDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })},
    estimated missed match is <strong className="tabular-number">{dollars(plan.estimatedLostMatch)}</strong>.
    This assumes your entered regular-pay match formula and no true-up; bonus matching is excluded.
  </p>;
}

function Difference({ plan }: { plan: ContributionPlan }) {
  const difference = Math.round((plan.projectedTotal - plan.goalAmount) * 100) / 100;
  return <span className="tabular-number">{difference > 0 ? `${dollars(difference)} above goal`
    : difference < 0 ? `${dollars(-difference)} below goal` : "Meets your goal"}</span>;
}

export function ResultCard({ plan, comparison, paycheckComparison, input, selectedRate,
  onSelectedRateChange, onUseRecommendation, className }: ResultCardProps) {
  const usedWidth = plan.goalAmount > 0 ? Math.min(100, plan.ytdTotal / plan.goalAmount * 100) : 0;
  const comingWidth = plan.goalAmount > 0
    ? Math.min(Math.max(0, 100 - usedWidth), Math.max(0, plan.projectedTotal - plan.ytdTotal) / plan.goalAmount * 100) : 0;
  const overshoot = Math.max(0, plan.projectedTotal - plan.goalAmount);
  const status = plan.errors.length > 0 ? "Check your inputs" : overshoot > 0 ? "Above goal"
    : plan.ytdTotal >= plan.goalAmount ? "Goal reached"
    : plan.recommendedRate === null ? "No new rate available"
    : plan.gap === 0 ? "Projected to meet goal"
    : plan.nextRateOvershoot > 0 ? "Closest whole rate" : "Below goal";
  return (
    <section id="planner-result" className={className} aria-labelledby="result-title" tabIndex={-1}>
      <div className="result-topline">
        <p className="eyebrow">YOUR RECOMMENDATION</p>
        <span className={`status-chip ${plan.errors.length > 0 || overshoot > 0 || (plan.gap > 0 && plan.nextRateOvershoot === 0)
          ? "status-chip--warning" : "status-chip--on-track"}`}>{status}</span>
      </div>
      <h2 id="result-title" className="result-heading">{plan.errors.length > 0 ? "Review your details"
        : plan.recommendedRate === null ? "No new rate to set" : "Set your contribution to"}</h2>
      {plan.errors.length > 0 ? <p className="result-empty">Fix the highlighted fields in the form to see your estimate.</p> : <>
        {plan.recommendedRate === null ? <p className="result-empty">{plan.paychecksRemaining === 0
          ? "No paychecks or eligible bonus payments remain this year."
          : "Your current rate applies to all remaining payments before a new rate could start."}</p> : <>
          <p className="result-rate tabular-number">{plan.recommendedRate}<span>%</span></p>
          {input.currentContributionRate !== null && <p className="result-from">
            From <span className="tabular-number">{input.currentContributionRate}%</span>
            {plan.paychecksAtCurrentRate > 0 && ` after ${plan.paychecksAtCurrentRate} more paycheck${plan.paychecksAtCurrentRate === 1 ? "" : "s"} at your current rate`}
          </p>}
          <p className="result-description">One fixed whole-number rate for your remaining pay and eligible bonuses.
            {overshoot === 0 ? " A whole percentage may leave a gap below your goal." : " Contributions already scheduled may exceed your goal."}</p>
        </>}
        <p className="estimate-basis">{input.contributionsYtdOverride === null
          ? "Using estimated YTD from salary and your current percentage. You can optionally enter the actual amount from a paystub."
          : "Using the actual YTD amount you entered."}</p>
        {paycheckComparison && <PaycheckChange comparison={paycheckComparison} />}
        <div className="progress-summary">
          <div className="progress-labels"><span>Already contributed</span><strong className="tabular-number">{dollars(plan.ytdTotal)}</strong></div>
          <div className="progress-track" aria-hidden="true">
            <span className="progress-used" style={{ width: `${usedWidth}%` }} />
            <span className="progress-coming" style={{ width: `${comingWidth}%` }} />
          </div>
          <div className="progress-labels"><span>Projected with recommendation</span><strong className="tabular-number">{dollars(plan.projectedTotal)}</strong></div>
        </div>
        <div className="result-stats">
          <div><span>{overshoot > 0 ? "Above goal" : "Gap to goal"}</span><strong className="tabular-number">{dollars(overshoot > 0 ? overshoot : plan.gap)}</strong></div>
          <div><span>Regular paychecks left</span><strong className="tabular-number">{plan.paychecksRemaining}</strong></div>
        </div>
        {plan.projectedAtCurrentRate !== null && input.currentContributionRate !== null && <p className="current-rate-projection">
          Keep your current <strong className="tabular-number">{input.currentContributionRate}%</strong>:
          projected year-end total <strong className="tabular-number">{dollars(plan.projectedAtCurrentRate)}</strong>.
        </p>}
        {plan.nextRate !== null && plan.nextRateOvershoot > 0 && <p className="overshoot-note">
          <span className="tabular-number">{plan.nextRate}%</span> would overshoot your goal by{" "}
          <strong className="tabular-number">{dollars(plan.nextRateOvershoot)}</strong>.</p>}
        {overshoot > 0 && <p className="notice notice--warning">Even a new rate of 0% cannot undo contributions already made or scheduled during your payroll delay. Check your payroll change timing.</p>}
        <MatchNotice plan={plan} />
        <div className="rate-check">
          <label htmlFor="rate-check-input">Try another whole-number rate</label>
          <div className="rate-check-row">
            <span className="percent-control">
              <input id="rate-check-input" className="rate-check-input tabular-number" type="number" min={0}
                max={input.planMaxPercent ?? 100} step={1} value={selectedRate}
                placeholder={plan.recommendedRate === null ? "—" : String(plan.recommendedRate)}
                aria-invalid={Boolean(comparison?.errors.length)} aria-describedby="rate-comparison"
                onChange={event => onSelectedRateChange(event.target.value)} />
              <span aria-hidden="true">%</span>
            </span>
            {selectedRate !== "" && <button className="text-button" type="button" onClick={onUseRecommendation}>Clear comparison</button>}
          </div>
          <div id="rate-comparison" aria-live="polite">
            {comparison && (comparison.errors.length > 0 ? <p className="field-error">{comparison.errors.join(" ")}</p> : <div className="comparison-summary">
              <p className="eyebrow">TRYING <span className="tabular-number">{selectedRate}%</span></p>
              <p className="comparison-total tabular-number">{dollars(comparison.projectedTotal)}</p>
              <p><Difference plan={comparison} /></p>
              <MatchNotice plan={comparison} />
              {comparison.issues.filter(issue => issue.severity === "warning" && (issue.field === "rate-check-input" || issue.field === null) && !plan.warnings.includes(issue.message) && !issue.message.startsWith("Match at risk")).map(issue => <p className="field-warning" key={issue.message}>{issue.message}</p>)}
            </div>)}
          </div>
          <span className="field-help">Your recommendation and paycheck table stay unchanged.</span>
        </div>
        <p className="projection-assumption">Projections do not assume payroll will stop at your goal or the IRS limit.
          Confirm payroll cutoff rules, especially if you contributed at another employer.</p>
      </>}
      <div className="notice-list">
        {plan.issues.filter(issue => issue.field === null && !issue.message.startsWith("Match at risk")).map(issue =>
          <p key={issue.message} className="notice notice--warning" role={issue.severity === "error" ? "alert" : "status"}>{issue.message}</p>)}
      </div>
    </section>
  );
}

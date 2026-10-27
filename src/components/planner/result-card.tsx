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
    Regular pay only; assumes no true-up.
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
      {plan.errors.length > 0 ? <p className="result-empty">Fix the highlighted fields.</p> : <>
        {plan.recommendedRate === null ? <p className="result-empty">{plan.paychecksRemaining === 0
          ? "No payments remain this year."
          : "Your current rate applies to all remaining payments."}</p> : <>
          <p className="result-rate tabular-number">{plan.recommendedRate}<span>%</span></p>
        </>}
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
          year-end total <strong className="tabular-number">{dollars(plan.projectedAtCurrentRate)}</strong>.
        </p>}
        {plan.nextRate !== null && plan.nextRateOvershoot > 0 && <p className="overshoot-note">
          <span className="tabular-number">{plan.nextRate}%</span> would overshoot your goal by{" "}
          <strong className="tabular-number">{dollars(plan.nextRateOvershoot)}</strong>.</p>}
        {overshoot > 0 && <p className="notice notice--warning">Scheduled contributions already exceed your goal. Check payroll timing.</p>}
        <MatchNotice plan={plan} />
        <div className="rate-check">
          <label htmlFor="rate-check-input">Use my own rate</label>
          <div className="rate-check-row">
            <span className="percent-control">
              <input id="rate-check-input" className="rate-check-input tabular-number" type="number" min={0}
                max={input.planMaxPercent ?? 100} step={1} value={selectedRate}
                placeholder={plan.recommendedRate === null ? "—" : String(plan.recommendedRate)}
                aria-invalid={Boolean(comparison?.errors.length)} aria-describedby="rate-comparison"
                onChange={event => onSelectedRateChange(event.target.value)} />
              <span aria-hidden="true">%</span>
            </span>
            {selectedRate !== "" && <button className="text-button" type="button" onClick={onUseRecommendation}>Use recommendation</button>}
          </div>
          <div id="rate-comparison" aria-live="polite">
            {comparison && (comparison.errors.length > 0 ? <p className="field-error">{comparison.errors.join(" ")}</p> : <div className="comparison-summary">
              <p className="eyebrow">YOUR RATE <span className="tabular-number">{selectedRate}%</span></p>
              <p className="comparison-total tabular-number">{dollars(comparison.projectedTotal)}</p>
              <p><Difference plan={comparison} /></p>
              <MatchNotice plan={comparison} />
              {comparison.issues.filter(issue => issue.severity === "warning" && (issue.field === "rate-check-input" || issue.field === null) && !plan.warnings.includes(issue.message) && !issue.message.startsWith("Match at risk")).map(issue => <p className="field-warning" key={issue.message}>{issue.message}</p>)}
            </div>)}
          </div>
        </div>
        <p className="projection-assumption">No automatic payroll cutoff assumed. Confirm limits across employers.</p>
      </>}
      <div className="notice-list">
        {plan.issues.filter(issue => issue.field === null && !issue.message.startsWith("Match at risk")).map(issue =>
          <p key={issue.message} className="notice notice--warning" role={issue.severity === "error" ? "alert" : "status"}>{issue.message}</p>)}
      </div>
    </section>
  );
}

import type { ContributionPlan, PlannerInput } from "@/lib/calc/types";

type ResultCardProps = {
  plan: ContributionPlan;
  input: PlannerInput;
  selectedRate: string;
  onSelectedRateChange: (value: string) => void;
  onUseRecommendation: () => void;
  className: string;
};

const wholeDollar = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function dollars(value: number): string {
  return wholeDollar.format(value);
}

export function ResultCard({
  plan,
  input,
  selectedRate,
  onSelectedRateChange,
  onUseRecommendation,
  className,
}: ResultCardProps) {
  const usedWidth =
    plan.goalAmount > 0
      ? Math.min(100, (plan.ytdTotal / plan.goalAmount) * 100)
      : 0;
  const comingWidth =
    plan.goalAmount > 0
      ? Math.min(
          Math.max(0, 100 - usedWidth),
          (Math.max(0, plan.projectedTotal - plan.ytdTotal) /
            plan.goalAmount) *
            100,
        )
      : 0;
  const targetOvershoot = Math.max(0, plan.projectedTotal - plan.goalAmount);
  return (
    <section className={className} aria-labelledby="result-title">
      <div className="result-topline">
        <p className="eyebrow">YOUR CONTRIBUTION PLAN</p>
        <span
          className={
            plan.errors.length > 0 || targetOvershoot > 0
              ? "status-chip status-chip--warning"
              : "status-chip status-chip--on-track"
          }
        >
          {plan.errors.length > 0
            ? "Needs attention"
            : targetOvershoot > 0
              ? "Over target"
              : plan.paychecksRemaining === 0
                ? "No paychecks left"
                : plan.gap > 0
                  ? "On track"
                  : "Goal reached"}
        </span>
      </div>
      <h2 id="result-title" className="result-heading">
        {plan.recommendedRate === null
          ? "No rate to show"
          : "Set your contribution to"}
      </h2>
      {plan.recommendedRate === null ? (
        <p className="result-empty">
          {plan.paychecksRemaining === 0
            ? plan.contributionEvents.some((event) => event.type === "bonus")
              ? "No regular paychecks remain, but an upcoming bonus can still be included."
              : "You have no paychecks left this year."
            : "There are no remaining contributions eligible for a new rate."}
        </p>
      ) : (
        <>
          <p className="result-rate tabular-number">
            {plan.recommendedRate}
            <span>%</span>
          </p>
          {input.currentContributionRate !== null && (
            <p className="result-from">
              From <span className="tabular-number">{input.currentContributionRate}%</span>
              {plan.paychecksAtCurrentRate > 0 &&
                ` for ${plan.paychecksAtCurrentRate} more paycheck${plan.paychecksAtCurrentRate === 1 ? "" : "s"}`}
            </p>
          )}
          <p className="result-description">
            {input.goalType === "max"
              ? `To reach the ${input.taxYear} legal maximum without going over.`
              : (
                  <>
                    To get as close as payroll allows to your{" "}
                    <span className="tabular-number">
                      {dollars(plan.goalAmount)}
                    </span>{" "}
                    target.
                  </>
                )}
          </p>
        </>
      )}

      {plan.errors.length === 0 && (
        <>
          <div className="progress-summary">
            <div className="progress-labels">
              <span>Already contributed</span>
              <strong className="tabular-number">{dollars(plan.ytdTotal)}</strong>
            </div>
            <div className="progress-track" aria-hidden="true">
              <span
                className="progress-used"
                style={{ width: `${usedWidth}%` }}
              />
              <span
                className="progress-coming"
                style={{ width: `${comingWidth}%` }}
              />
            </div>
            <div className="progress-labels">
              <span>Projected by year end</span>
              <strong className="tabular-number">
                {dollars(plan.projectedTotal)}
              </strong>
            </div>
          </div>

          <div className="result-stats">
            <div>
              <span>{plan.gap > 0 ? "Still under goal" : "Goal remaining"}</span>
              <strong className="tabular-number">{dollars(plan.gap)}</strong>
            </div>
            <div>
              <span>Paychecks left</span>
              <strong className="tabular-number">
                {plan.paychecksRemaining}
              </strong>
            </div>
          </div>

          {plan.projectedAtCurrentRate !== null &&
            input.currentContributionRate !== null && (
              <p className="current-rate-projection">
                If your current{" "}
                <strong className="tabular-number">
                  {input.currentContributionRate}%
                </strong>{" "}
                rate stays in place, projected year-end contributions are{" "}
                <strong className="tabular-number">
                  {dollars(plan.projectedAtCurrentRate)}
                </strong>
                . This includes future raises and eligible bonuses; past changes
                are not included in the salary-based year-to-date estimate.
              </p>
            )}

          {plan.nextRate !== null && plan.nextRateOvershoot > 0 && (
            <p className="overshoot-note">
              <span className="tabular-number">{plan.nextRate}%</span> would
              overshoot by{" "}
              <strong className="tabular-number">
                {dollars(plan.nextRateOvershoot)}
              </strong>
              .
            </p>
          )}

          {targetOvershoot > 0 && (
            <p className="notice notice--warning">
              At the simulated rate, your projected total is{" "}
              <strong className="tabular-number">
                {dollars(targetOvershoot)}
              </strong>{" "}
              over your goal. Check your update delay and payroll settings.
            </p>
          )}

          {plan.matchAtRisk && plan.limitReachedDate && (
            <p className="notice notice--info">
              You may hit the limit on{" "}
              {new Date(`${plan.limitReachedDate}T12:00:00`).toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric" },
              )}
              . With no true-up, estimated missed match:{" "}
              <strong className="tabular-number">
                {dollars(plan.estimatedLostMatch)}
              </strong>
              .
            </p>
          )}

          <div className="rate-check">
            <label htmlFor="rate-check-input">
              Check another whole-number rate
            </label>
            <div className="rate-check-row">
              <span className="percent-control">
                <input
                  id="rate-check-input"
                  className="rate-check-input tabular-number"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={selectedRate}
                  placeholder={
                    plan.recommendedRate === null
                      ? "—"
                      : String(plan.recommendedRate)
                  }
                  aria-label="Try another contribution percentage"
                  onChange={(event) =>
                    onSelectedRateChange(event.target.value)
                  }
                />
                <span aria-hidden="true">%</span>
              </span>
              {selectedRate !== "" && (
                <button
                  className="text-button"
                  type="button"
                  onClick={onUseRecommendation}
                >
                  Use recommendation
                </button>
              )}
            </div>
            <span className="field-help">
              This compares a rate you enter; it does not change the recommendation.
            </span>
          </div>
        </>
      )}
    </section>
  );
}

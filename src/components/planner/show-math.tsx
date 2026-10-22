import type { ContributionPlan, PlannerInput } from "@/lib/calc/types";

type ShowMathProps = {
  plan: ContributionPlan;
  input: PlannerInput;
  className: string;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function ShowMath({ plan, input, className }: ShowMathProps) {
  const rateBeforePlanCap =
    plan.eligibleGross > 0
      ? Math.max(
          0,
          Math.floor(
            ((plan.goalAmount -
              plan.ytdTotal -
              plan.contributionsAtCurrentRate) /
              plan.eligibleGross) *
              100,
          ),
        )
      : null;

  return (
    <details className={className}>
      <summary>Show the math</summary>
      <div className="math-content">
        <ol>
          <li>
            <span>2026 IRS employee limit for your age</span>
            <strong className="tabular-number">
              {money.format(plan.legalLimit)}
            </strong>
          </li>
          <li>
            <span>Your goal after the legal limit is applied</span>
            <strong className="tabular-number">
              {money.format(plan.goalAmount)}
            </strong>
          </li>
          <li>
            <span>
              Already contributed across employers
            </span>
            <strong className="tabular-number">
              {money.format(plan.ytdTotal)}
            </strong>
          </li>
          <li>
            <span>Future contributions at your current rate</span>
            <strong className="tabular-number">
              {money.format(plan.contributionsAtCurrentRate)}
            </strong>
          </li>
          <li>
            <span>Gross pay and bonuses eligible for a new rate</span>
            <strong className="tabular-number">
              {money.format(plan.eligibleGross)}
            </strong>
          </li>
          <li>
            <span>Whole-rate calculation before plan maximum</span>
            <strong className="tabular-number">
              {rateBeforePlanCap === null
                ? "No rate"
                : `floor(remaining need / eligible gross) = ${rateBeforePlanCap}%`}
            </strong>
          </li>
          {input.planMaxPercent !== null && (
            <li>
              <span>Your plan&apos;s maximum contribution rate</span>
              <strong className="tabular-number">
                {input.planMaxPercent}%
              </strong>
            </li>
          )}
          <li>
            <span>Projected year-end total</span>
            <strong className="tabular-number">
              {money.format(plan.projectedTotal)}
            </strong>
          </li>
          <li>
            <span>Remaining gap to goal</span>
            <strong className="tabular-number">{money.format(plan.gap)}</strong>
          </li>
        </ol>
        <p className="math-disclaimer">
          Estimates use the gross amounts and dates you entered. Your payroll
          system may apply its own withholding rules.
        </p>
      </div>
    </details>
  );
}

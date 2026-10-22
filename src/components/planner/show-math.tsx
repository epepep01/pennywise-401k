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
  return (
    <details className={className}>
      <summary>Show the math</summary>
      <div className="math-content">
        <ol>
          <li>
            <span>{input.taxYear} IRS employee limit for your age</span>
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
            <span>Highest whole rate within your goal and plan cap</span>
            <strong className="tabular-number">
              {plan.recommendedRate === null ? "No new rate" : `${plan.recommendedRate}%`}
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
          Each allowed whole-number rate is checked against paycheck-by-paycheck deductions rounded to cents.
          The highest rate that stays within your goal is recommended. Contributions already scheduled during a payroll delay cannot be undone.
          Totals do not assume an automatic payroll cutoff. Gross pay uses annual salary divided by the normal pay periods; raises apply by payday without proration.
        </p>
      </div>
    </details>
  );
}

import type { ContributionPlan, PlannerInput } from "@/lib/calc/types";

type ShowMathProps = {
  plan: ContributionPlan;
  input: PlannerInput;
  className: string;
  isCustomRate?: boolean;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function ShowMath({ plan, input, className, isCustomRate = false }: ShowMathProps) {
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
            <span>Annual goal (capped at IRS limit)</span>
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
            <span>Pay eligible for a new rate</span>
            <strong className="tabular-number">
              {money.format(plan.eligibleGross)}
            </strong>
          </li>
          <li>
            <span>Recommended whole rate</span>
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
          {isCustomRate && <li>
            <span>Your selected rate</span>
            <strong className="tabular-number">{plan.selectedRate}%</strong>
          </li>}
          <li>
            <span>Projected year-end total</span>
            <strong className="tabular-number">
              {money.format(plan.projectedTotal)}
            </strong>
          </li>
          <li>
            <span>Gap below goal</span>
            <strong className="tabular-number">{money.format(plan.gap)}</strong>
          </li>
        </ol>
        <p className="math-disclaimer">
          Rates use cent-rounded deductions. The recommendation stays within your goal when possible;
          a custom rate may exceed it. Delayed deductions still apply. No automatic cutoff is assumed.
          Raises use calendar-day proration from the day after the previous payday through payday,
          inclusive. Payroll periods and methods may differ.
        </p>
      </div>
    </details>
  );
}

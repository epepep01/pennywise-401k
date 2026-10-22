import type { PaycheckComparison } from "@/lib/calc/types";
import { formatDollars } from "../../lib/calc/money";

export function PaycheckChange({ comparison }: { comparison: PaycheckComparison }) {
  const paycheck = comparison.firstNewPaycheck;
  if (!paycheck) return null;
  const date = new Date(`${paycheck.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const change = comparison.changePerPaycheck;
  return (
    <section className="paycheck-dollar-comparison" aria-labelledby="paycheck-dollar-title">
      <h3 id="paycheck-dollar-title">What changes per paycheck?</h3>
      <p className="field-help">For your {date} paycheck, using the same <span className="tabular-number">{formatDollars(paycheck.gross)}</span> gross pay.</p>
      <div className="paycheck-dollar-cards">
        <div className="paycheck-dollar-card">
          <span>Current rate {comparison.currentRate !== null && <span className="tabular-number">· {comparison.currentRate}%</span>}</span>
          <strong className="tabular-number">{comparison.currentRateContribution === null ? "—" : formatDollars(comparison.currentRateContribution)}</strong>
          <small>Employee contribution</small>
        </div>
        <div className="paycheck-dollar-card paycheck-dollar-card--new">
          <span>Recommended <span className="tabular-number">· {paycheck.rate}%</span></span>
          <strong className="tabular-number">{formatDollars(paycheck.contribution)}</strong>
          <small>Employee contribution</small>
        </div>
      </div>
      {change !== null ? <p className="paycheck-dollar-delta">
        <strong className="tabular-number">{change > 0 ? "+" : change < 0 ? "−" : ""}{formatDollars(Math.abs(change))}</strong>
        {" "}{change === 0 ? "change in contributions" : change > 0 ? "more contributed" : "less contributed"} per paycheck at this gross pay.
      </p> : <p className="field-help">Enter your current percentage to compare the dollar amounts.</p>}
      <p className="field-help">Contribution amounts only; take-home pay also depends on taxes and benefits. Later raises appear in the table.</p>
    </section>
  );
}

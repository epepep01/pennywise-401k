import { useState } from "react";
import type { ContributionEvent, PaycheckComparison } from "@/lib/calc/types";
import { contributionAtRate } from "../../lib/calc/calculator";

type PaycheckTableProps = {
  events: ContributionEvent[];
  comparison: PaycheckComparison;
  className: string;
  rateLabel: string;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const PAGE_SIZE = 10;
type View = "comparison" | "projection";
type Row = Pick<ContributionEvent, "id" | "date" | "type" | "gross" | "rate" | "contribution"> & { yearToDate: number | null };

function ScheduleRow({ row, comparison, view, historical = false }: {
  row: Row; comparison: PaycheckComparison; view: View; historical?: boolean;
}) {
  const before = historical || comparison.reference?.id === row.id;
  const after = comparison.firstNewPaycheck?.id === row.id;
  const changing = comparison.currentRate !== null && comparison.firstNewPaycheck?.rate !== comparison.currentRate;
  const oldContribution = comparison.currentRate === null ? null : contributionAtRate(row.gross, comparison.currentRate);
  const change = oldContribution === null ? null : Math.round((row.contribution - oldContribution) * 100) / 100;
  return (
    <tr className={before ? "paycheck-before-row" : row.type === "bonus" ? "bonus-row" : undefined}>
      <td>{new Date(`${row.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        {before && <span className="paycheck-row-note">{changing ? "Before rate change" : "Reference paycheck"}{historical ? " · estimate" : ""}</span>}
        {after && <span className="paycheck-row-note paycheck-row-note--new">{changing ? "First paycheck at new rate" : "First paycheck in plan"}</span>}
      </td>
      <td><span className={row.type === "bonus" ? "event-type event-type--bonus" : "event-type"}>
        {historical ? "Prior paycheck" : row.type === "bonus" ? "Bonus" : "Paycheck"}
      </span></td>
      <td className="tabular-number">{money.format(row.gross)}</td>
      {view === "comparison" && <td className="tabular-number">{oldContribution === null ? "—" : money.format(oldContribution)}</td>}
      <td className="tabular-number">{money.format(row.contribution)}<span className="table-rate"> ({row.rate}%)</span></td>
      {view === "comparison" ? <td className="tabular-number">{historical || change === null ? "—"
        : `${change > 0 ? "+" : change < 0 ? "−" : ""}${money.format(Math.abs(change))}`}</td>
        : <td className="tabular-number">{row.yearToDate === null ? "—" : money.format(row.yearToDate)}</td>}
    </tr>
  );
}

export function PaycheckTable({ events, comparison, className, rateLabel }: PaycheckTableProps) {
  const [page, setPage] = useState(0);
  const [view, setView] = useState<View>("comparison");
  const pageCount = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleEvents = events.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const reference = comparison.reference;
  return (
    <section className={className} aria-labelledby="schedule-title">
      <div className="schedule-heading">
        <div><p className="eyebrow">YOUR PAYCHECK CONTRIBUTIONS</p><h2 id="schedule-title">Paycheck-by-paycheck</h2>
          <p className="field-help" aria-live="polite">{rateLabel}</p>
        </div>
        <span className="schedule-count">{events.length} upcoming events</span>
      </div>
      <div className="schedule-view-controls" role="group" aria-label="Contribution table view">
        <button type="button" aria-pressed={view === "comparison"} onClick={() => setView("comparison")}>Old vs new ($)</button>
        <button type="button" aria-pressed={view === "projection"} onClick={() => setView("projection")}>Year-end projection</button>
      </div>
      {events.length === 0 ? <p className="empty-schedule">Fix the highlighted fields to show this schedule.</p> : <>
        <div className="table-scroll" role="region" aria-label="Contribution comparison table" tabIndex={0}>
          <table>
            <caption className="schedule-caption">{view === "comparison"
              ? "Employee contributions at current and selected rates."
              : "Selected-rate schedule and running employee contributions."}</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Gross pay</th>
              {view === "comparison" && <th scope="col">Old rate{comparison.currentRate !== null && <span className="tabular-number"> · {comparison.currentRate}%</span>}</th>}
              <th scope="col">Selected rate</th><th scope="col">{view === "comparison" ? "Change ($)" : "Year to date"}</th>
            </tr></thead>
            <tbody>
              {currentPage === 0 && reference?.isHistoricalEstimate && <ScheduleRow historical view={view} comparison={comparison}
                row={{ ...reference, type: "paycheck", yearToDate: null }} />}
              {visibleEvents.map(event => <ScheduleRow key={event.id} row={event} comparison={comparison} view={view} />)}
            </tbody>
          </table>
        </div>
        {reference && <p className="schedule-reference-note">{reference.isHistoricalEstimate
          ? "Shaded paycheck: estimate only; excluded from totals."
          : "Shaded paycheck: last at your current rate."}
</p>}
        {comparison.currentRate === null && <p className="schedule-reference-note">Enter your current rate for a dollar comparison.</p>}
      </>}
      {events.length > PAGE_SIZE && <nav className="table-pagination" aria-label="Paycheck table pages">
        <button className="button button--secondary button--compact" type="button" disabled={currentPage === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>Previous</button>
        <span aria-live="polite">Page {currentPage + 1} of {pageCount} · Upcoming events {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, events.length)} of {events.length}</span>
        <button className="button button--secondary button--compact" type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))}>Next</button>
      </nav>}
    </section>
  );
}
